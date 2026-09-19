import sys
import os
import pytest

# Ensure scripts module can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../scripts')))

from benchmark_metrics import calculate_iou, calculate_f1, calculate_relative_error, calculate_enl, calculate_ece
from run_benchmark_20 import run_synthetic_benchmark

@pytest.fixture(scope="module")
def benchmark_data():
    """Runs the benchmark suite once and caches the JSON output for the test functions."""
    return run_synthetic_benchmark()["tests"]

def get_test_case(benchmark_data, q_id):
    for test in benchmark_data:
        if test["query_id"] == q_id:
            return test
    return None

def test_q01_object_counting(benchmark_data):
    test_data = get_test_case(benchmark_data, "Q01")
    assert test_data is not None
    assert test_data["pass"] is True
    assert test_data["metrics"]["count_error_pct"] < 10.0
    assert test_data["metrics"]["iou"] >= 0.60

def test_q04_road_grounding(benchmark_data):
    test_data = get_test_case(benchmark_data, "Q04")
    assert test_data is not None
    assert test_data["metrics"]["iou"] >= 0.55
    assert test_data["metrics"]["f1"] >= 0.80

def test_q08_cross_modal_flood(benchmark_data):
    test_data = get_test_case(benchmark_data, "Q08")
    assert test_data is not None
    assert test_data["metrics"]["iou"] >= 0.70
    assert test_data["metrics"]["enl"] > 30.0

def test_math_functions():
    """Validates the mathematical metrics logic."""
    iou = calculate_iou((0,0,10,10), (5,5,15,15))
    assert 0.14 < iou < 0.15 # 25 / 175 = 0.1428...
    
    f1 = calculate_f1(0.8, 0.8)
    assert abs(f1 - 0.8) < 1e-9
    
    err = calculate_relative_error(90, 100)
    assert err == 10.0
    
    enl = calculate_enl(10.0, 2.0)
    assert enl == 50.0
    
    ece = calculate_ece([0.9, 0.6], [0.85, 0.55], [100, 100], 200)
    assert abs(ece - 0.05) < 0.001
