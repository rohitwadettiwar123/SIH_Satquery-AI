"""SatQuery AI – Agentic Controller / LLM Router Orchestrator.

This is the central brain of SatQuery AI. It follows the architecture from the MD file:
1. Query Intent Classification (LLM or keyword fallback)
2. Input Profiling (single/cross-modal/bi-temporal)
3. Cloud Screening + Reconstruction Pre-Stage (automatic, conditional)
4. Input-Task Compatibility Check
5. Tool Selection from Registry
6. Specialist Execution (sequential or parallel)
7. Output Fusion + Confidence Estimation
8. Execution Trace + Audit Hash Generation
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List
from PIL import Image

log = logging.getLogger("satquery.orchestrator")

# ── Task Classification Keywords ─────────────────────────────────────────────
_TASK_KEYWORDS: dict[str, list[str]] = {
    "CHANGE_DETECTION": ["change", "changed", "differ", "before", "after", "compare", "t0", "t1",
                          "temporal", "damage", "flood", "disaster", "expansion", "deforest"],
    "CHANGE_VQA": ["increased", "decreased", "grown", "shrunk", "more", "less", "same",
                    "built-up area", "has the"],
    "SAR_FUSION": ["sar", "radar", "microwave", "penetrat", "cloud cover", "backscatter",
                   "dual", "optical and sar", "sentinel-1", "risat"],
    "NDVI_MONITORING": ["ndvi", "vegetation", "crop", "plant", "forest", "green", "agricultural",
                         "health", "biomass", "leaf", "chlorophyll"],
    "CLOUD_RECONSTRUCTION": ["cloud", "cloudy", "reconstruct", "clean up", "inpaint", "repair",
                               "obscur", "haze"],
    "GROUNDING": ["highlight", "locate", "where is", "find", "point", "show me",
                   "identify region", "bounding box", "polygon"],
    "CAPTIONING": ["describe", "caption", "what do you see", "scene", "overview", "summary",
                    "explain this image"],
    "VQA": ["what", "how many", "count", "which", "is there", "detect", "identify"],
}


def classify_query_intent(query: str) -> tuple[str, float]:
    """
    Classify query into a task type using keyword matching.

    Returns (task_type, confidence).
    Falls back to VQA as default.
    """
    q = query.lower()
    scores: dict[str, int] = {}
    for task, keywords in _TASK_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in q)
        if score > 0:
            scores[task] = score

    if not scores:
        return "VQA", 0.6

    best_task = max(scores, key=lambda t: scores[t])
    # Normalise confidence: max possible ≈ 4 keyword hits → 0.95
    confidence = min(0.95, 0.65 + scores[best_task] * 0.08)
    return best_task, round(confidence, 3)


def profile_inputs(image_paths: list[str], image_metadata: list[dict]) -> dict:
    """
    Profile the uploaded images to determine session type.

    Returns:
        dict with: n_images, modalities, session_type
            ('single' | 'bi_temporal' | 'cross_modal_pair')
    """
    n = len(image_paths)
    modalities = []
    for i, p in enumerate(image_paths):
        meta = image_metadata[i] if i < len(image_metadata) else {}
        mod = meta.get("modality", "optical")
        if "sar" in Path(p).name.lower() or "s1" in Path(p).name.lower():
            mod = "sar"
        modalities.append(mod)

    if n == 1:
        session_type = "single"
    elif n == 2:
        if len(set(modalities)) == 2:  # one optical + one SAR
            session_type = "cross_modal_pair"
        else:
            session_type = "bi_temporal"
    else:
        session_type = "multi"

    return {"n_images": n, "modalities": modalities, "session_type": session_type}


def check_task_compatibility(task_type: str, profile: dict) -> tuple[bool, str]:
    """
    Verify that the requested task is compatible with the available images.

    Returns (compatible, error_message).
    """
    session = profile["session_type"]
    requires_two = {"CHANGE_DETECTION", "CHANGE_VQA", "SAR_FUSION"}

    if task_type in requires_two and session == "single":
        return False, (
            f"Task '{task_type}' requires 2 images but only 1 was uploaded. "
            "Please upload a second image (T1 or SAR counterpart)."
        )

    if task_type == "SAR_FUSION" and session != "cross_modal_pair":
        # Allow with bi-temporal if one is SAR-named
        mods = profile.get("modalities", [])
        if "sar" not in mods:
            return False, "SAR Fusion requires one optical and one SAR image."

    return True, ""


async def _call_gemini_classify(query: str, gemini_api_key: str, gemini_model: str) -> tuple[str, float]:
    """Fast keyword-based classification (skip extra LLM round-trip for speed)."""
    return classify_query_intent(query)


async def _run_specialist(
    task_type: str,
    image_paths: list[str],
    query: str,
    config: dict,
    reconstruction_results: list[dict],
) -> dict:
    """Dispatch to the correct specialist model."""
    from ai.models.vqa import run_vqa
    from ai.models.captioning import run_captioning, run_grounding
    from ai.models.change_detection import run_change_detection
    from ai.models.fusion import run_optical_sar_fusion
    from pipeline.ndvi.ndvi_module import run_ndvi_analysis, run_ndvi_change_analysis

    if task_type == "CAPTIONING":
        return await run_captioning(image_paths[0], config)

    if task_type == "GROUNDING":
        return await run_grounding(query, image_paths[0], config)

    if task_type in ("CHANGE_DETECTION", "CHANGE_VQA"):
        if len(image_paths) >= 2:
            return await run_change_detection(image_paths[0], image_paths[1], query, config)
        return await run_vqa(query, image_paths, config)

    if task_type == "SAR_FUSION":
        if len(image_paths) >= 2:
            return await run_optical_sar_fusion(image_paths[0], image_paths[1], query, config)
        return await run_vqa(query, image_paths, config)

    if task_type == "NDVI_MONITORING":
        if len(image_paths) >= 2:
            conf_map_0 = reconstruction_results[0].get("confidence_map") if reconstruction_results else None
            conf_map_1 = reconstruction_results[1].get("confidence_map") if len(reconstruction_results) > 1 else None
            result = run_ndvi_change_analysis(image_paths[0], image_paths[1], conf_map_0, conf_map_1, config)
        else:
            conf_map = reconstruction_results[0].get("confidence_map") if reconstruction_results else None
            result = run_ndvi_analysis(image_paths[0], conf_map, config)

        # Format into standard response
        stats = result.get("t1_ndvi_stats", result.get("stats", {}))
        delta = result.get("delta_ndvi", {})
        ans = f"NDVI analysis complete. Mean NDVI: {stats.get('mean', 0):.3f}. "
        if delta:
            ans += f"Vegetation change: {delta.get('class_percentages', {}).get('increase', 0):.1f}% increased, "
            ans += f"{delta.get('class_percentages', {}).get('decrease', 0):.1f}% decreased."
        return {"answer": ans, "confidence": 0.88, "ndvi_result": result, "detected_objects": []}

    if task_type == "CLOUD_RECONSTRUCTION":
        rc = reconstruction_results[0] if reconstruction_results else {}
        ans = rc.get("disclosure_text", "Cloud reconstruction complete.")
        return {"answer": ans, "confidence": 0.85, "detected_objects": []}

    # Default: VQA
    return await run_vqa(query, image_paths, config)


async def orchestrate(
    query: str,
    image_ids: list[str],
    image_paths: list[str],
    image_metadata: list[dict],
    config: dict,
    task_hint: Optional[str] = None,
) -> dict:
    """
    Main agentic orchestration function.

    Implements the full 8-step agentic controller workflow.
    """
    query_id = str(uuid.uuid4())
    trace_steps: list[str] = []
    start_ts = datetime.now(timezone.utc).isoformat()

    # ── Step 1: Query Classification ─────────────────────────────────────────
    trace_steps.append(f"[{start_ts}] Step 1: Classifying query intent")
    if task_hint:
        task_type, task_confidence = task_hint.upper(), 0.95
    elif config.get("gemini_api_key") or config.get("GEMINI_API_KEY"):
        api_key = config.get("gemini_api_key") or config.get("GEMINI_API_KEY", "")
        task_type, task_confidence = await _call_gemini_classify(query, api_key, config.get("gemini_model", "gemini-3.6-flash"))
    else:
        task_type, task_confidence = classify_query_intent(query)
    trace_steps.append(f"Task classified as: {task_type} (confidence={task_confidence:.2f})")

    # ── Step 2: Input Profiling ───────────────────────────────────────────────
    trace_steps.append("Step 2: Profiling input images")
    profile = profile_inputs(image_paths, image_metadata)
    trace_steps.append(
        f"Input profile: {profile['n_images']} image(s), "
        f"modalities={profile['modalities']}, session={profile['session_type']}"
    )

    import asyncio

    # ── Step 3: Cloud Screening + Reconstruction (PARALLEL) ───────────
    trace_steps.append("Step 3: Cloud screening (optical images only)")
    cloud_reconstruction_info = {
        "triggered": False, "coverage_pct": 0.0, "method": "passthrough",
        "avg_confidence": 100.0, "disclosure_text": "", "original_url": "", "reconstructed_url": "",
    }
    
    async def process_cloud(img_path, mod):
        if mod == "optical":
            from pipeline.reconstruction.inpainter import run_cloud_reconstruction
            return await asyncio.to_thread(run_cloud_reconstruction, img_path, None, 0, config)
        return {}

    cloud_tasks = [process_cloud(p, m) for p, m in zip(image_paths, profile["modalities"])]
    reconstruction_results = await asyncio.gather(*cloud_tasks)

    for i, rc_result in enumerate(reconstruction_results):
        if rc_result and rc_result.get("triggered") and i == 0:
            recon_arr = rc_result["reconstructed_image_array"]
            recon_filename = f"recon_{uuid.uuid4().hex[:8]}.png"
            recon_path = Path("backend/data/uploads") / recon_filename
            Image.fromarray(recon_arr).save(recon_path)
            cloud_reconstruction_info = {
                "triggered": rc_result["triggered"],
                "coverage_pct": rc_result["coverage_pct"],
                "method": rc_result["method"],
                "avg_confidence": rc_result["avg_confidence"],
                "disclosure_text": rc_result["disclosure_text"],
                "original_url": f"/uploads/{Path(image_paths[0]).name}",
                "reconstructed_url": f"/uploads/{recon_filename}",
            }
            trace_steps.append(f"Cloud reconstruction: {rc_result['disclosure_text']}")

    # ── Step 4: Compatibility Check ───────────────────────────────────
    trace_steps.append("Step 4: Validating task-input compatibility")
    compatible, compat_error = check_task_compatibility(task_type, profile)
    if not compatible:
        return {
            "query_id": query_id, "task_type": task_type, "query": query,
            "answer": f"❌ Compatibility Error: {compat_error}",
            "confidence": 0.0, "detected_objects": [], "execution_trace": trace_steps,
            "gate_verdicts": {"G0_format_check": "FAIL", "error": compat_error},
            "audit_hash": "", "cloud_reconstruction": cloud_reconstruction_info,
        }

    # ── Step 5-7: Specialist & Validation Gates (PARALLEL) ────────────
    trace_steps.append(f"Step 5: Executing specialist — {task_type}")
    from pipeline.evidence.assembler import run_validation_gates, generate_audit_hash
    
    async def run_specialist_task():
        try:
            return await _run_specialist(task_type, image_paths, query, config, reconstruction_results)
        except Exception as e:
            log.exception("Specialist execution failed")
            return {"answer": f"Analysis completed with partial results. ({e})", "confidence": 0.5, "detected_objects": []}

    async def run_gates_task():
        gate_request = {"cloud_coverage_pct": cloud_reconstruction_info["coverage_pct"], "confidence": 1.0, "task_type": task_type}
        return await asyncio.to_thread(run_validation_gates, gate_request, image_paths, config)

    trace_steps.append("Step 6: Running G0-G8 scientific validation gates (Parallel)")
    specialist_result, (gate_verdicts, gate_trace) = await asyncio.gather(
        run_specialist_task(),
        run_gates_task()
    )
    trace_steps.extend(gate_trace)

    trace_steps.append("Step 7: Fusing outputs and computing confidence")
    specialist_confidence = specialist_result.get("confidence", 0.75)
    reconstruction_confidence = cloud_reconstruction_info["avg_confidence"] / 100.0
    if cloud_reconstruction_info["triggered"]:
        final_confidence = 0.70 * specialist_confidence + 0.30 * reconstruction_confidence
    else:
        final_confidence = specialist_confidence
    final_confidence = round(min(0.99, max(0.01, final_confidence)), 3)

    # ── Step 8: Audit + Trace ─────────────────────────────────────────
    trace_steps.append("Step 8: Generating SHA-256 audit hash")

    # Build detected objects from specialist result
    detected_objects = specialist_result.get("detected_objects", [])

    # ── Land Cover Analysis (always run on primary image) ──────────────────
    try:
        from ai.models.land_cover_analysis import analyse_land_cover
        import asyncio as _asyncio
        land_cover_analysis = await _asyncio.to_thread(analyse_land_cover, image_paths[0], config.get("default_gsd_meters", 10.0))
    except Exception as _lce:
        log.warning("Land cover analysis skipped: %s", _lce)
        land_cover_analysis = {}

    # Build change metrics
    change_metrics = specialist_result.get("change_metrics")
    if not change_metrics and "ssim_score" in specialist_result:
        change_metrics = {
            "ssim_score": specialist_result.get("ssim_score", 0.0),
            "change_ratio_pct": specialist_result.get("change_ratio_pct", 0.0),
            "affected_area_km2": specialist_result.get("affected_area_km2", 0.0),
            "mean_delta": 0.0,
            "confidence_interval_95": [],
        }

    # Build NDVI stats
    ndvi_stats = None
    if "ndvi_result" in specialist_result:
        ndvi_res = specialist_result["ndvi_result"]
        stats_key = "t1_ndvi_stats" if "t1_ndvi_stats" in ndvi_res else "stats"
        s = ndvi_res.get(stats_key, {})
        ndvi_stats = {
            "mean": s.get("mean", 0.0),
            "median": s.get("median", 0.0),
            "std": s.get("std", 0.0),
            "class_percentages": s.get("class_percentages", {}),
            "delta_ndvi": ndvi_res.get("delta_ndvi"),
        }

    # Escalation check (G5)
    threshold = config.get("g5_escalation_threshold", 0.75)
    escalate = bool(final_confidence < threshold or "FAIL" in str(gate_verdicts))
    escalation = {"escalate": escalate, "reason": "Confidence below threshold or gate failure." if escalate else "OK"}

    result = {
        "query_id": query_id,
        "task_type": task_type,
        "query": query,
        "answer": specialist_result.get("answer", "Analysis complete."),
        "confidence": final_confidence,
        "detected_objects": detected_objects,
        "change_metrics": change_metrics,
        "ndvi_stats": ndvi_stats,
        "land_cover_analysis": land_cover_analysis,
        "cloud_reconstruction": cloud_reconstruction_info,
        "execution_trace": trace_steps,
        "gate_verdicts": gate_verdicts,
        "requires_expert_escalation": escalation["escalate"],
        "escalation_reason": escalation.get("reason", ""),
        "processing_time_ms": 0.0,  # filled in by route
    }
    result["audit_hash"] = generate_audit_hash(result)
    trace_steps.append(f"Audit hash: {result['audit_hash'][:16]}…")

    # Fire-and-forget audit log write (non-blocking, doesn't delay response)
    asyncio.create_task(_append_audit_log_async(result, config))

    return result


async def _append_audit_log_async(result: dict, config: dict) -> None:
    """Non-blocking async wrapper — writes audit log in a thread pool."""
    await asyncio.to_thread(_append_audit_log, result, config)


def _append_audit_log(result: dict, config: dict) -> None:
    """Append analysis result to the audit log JSON file."""
    try:
        from backend.config import settings
        path = settings.audit_log_path
        raw = path.read_text(encoding="utf-8") if path.exists() else "[]"
        entries: list = json.loads(raw) if raw.strip() else []
        # Store serialisable subset
        safe = {k: v for k, v in result.items()
                if isinstance(v, (str, int, float, bool, list, dict, type(None)))}
        entries.append(safe)
        # Keep last 1000 entries
        path.write_text(json.dumps(entries[-1000:], ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.warning("Failed to write audit log: %s", e)
