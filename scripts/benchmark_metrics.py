import math
from typing import List, Set, Tuple

def calculate_iou(box1: Tuple[float, float, float, float], box2: Tuple[float, float, float, float]) -> float:
    """Calculates Intersection over Union (IoU) for two bounding boxes (x1, y1, x2, y2)."""
    x1_inter = max(box1[0], box2[0])
    y1_inter = max(box1[1], box2[1])
    x2_inter = min(box1[2], box2[2])
    y2_inter = min(box1[3], box2[3])

    if x2_inter <= x1_inter or y2_inter <= y1_inter:
        return 0.0

    intersection = (x2_inter - x1_inter) * (y2_inter - y1_inter)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection

    return intersection / union if union > 0 else 0.0

def calculate_f1(precision: float, recall: float) -> float:
    """Calculates the F1 score given precision and recall."""
    if precision + recall == 0:
        return 0.0
    return 2 * (precision * recall) / (precision + recall)

def calculate_relative_error(pred: float, true: float) -> float:
    """Calculates relative error as a percentage."""
    if true == 0:
        return 0.0 if pred == 0 else float('inf')
    return (abs(pred - true) / true) * 100.0

def calculate_enl(mean: float, variance: float) -> float:
    """Calculates Equivalent Number of Looks (ENL) for SAR images: mean^2 / variance."""
    if variance == 0:
        return float('inf')
    return (mean ** 2) / variance

def calculate_ece(confidences: List[float], accuracies: List[float], bin_counts: List[int], total_samples: int) -> float:
    """
    Calculates Expected Calibration Error (ECE).
    confidences: average confidence per bin
    accuracies: accuracy per bin
    bin_counts: number of samples in each bin
    total_samples: total number of samples across all bins
    """
    if total_samples == 0:
        return 0.0
    
    ece = 0.0
    for conf, acc, count in zip(confidences, accuracies, bin_counts):
        weight = count / total_samples
        ece += weight * abs(acc - conf)
    return ece
