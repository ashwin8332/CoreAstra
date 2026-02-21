"""
Connection Manager Backend - Quick Test Script
Tests all major endpoints to verify functionality
"""
import requests
import json
from time import sleep

BASE_URL = "http://localhost:8001"


def test_health():
    """Test health endpoint"""
    print("\n[TEST] Health Check")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✅ Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


def test_root():
    """Test root endpoint"""
    print("\n[TEST] Root Endpoint")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✅ Status: {response.status_code}")
        data = response.json()
        print(f"   Service: {data['service']}")
        print(f"   Version: {data['version']}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


def test_list_empty_sessions():
    """Test listing sessions when empty"""
    print("\n[TEST] List Sessions (Empty)")
    try:
        response = requests.get(f"{BASE_URL}/connections")
        print(f"✅ Status: {response.status_code}")
        data = response.json()
        print(f"   Sessions: {len(data['sessions'])}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


def test_ssh_connection_fail():
    """Test SSH connection with invalid credentials (should fail gracefully)"""
    print("\n[TEST] SSH Connection (Invalid - Expected to Fail)")
    try:
        response = requests.post(
            f"{BASE_URL}/connections/ssh",
            json={
                "host": "invalid.example.com",
                "username": "testuser",
                "password": "testpass",
                "port": 22,
                "timeout": 5
            }
        )
        print(f"✅ Status: {response.status_code}")
        if response.status_code == 400:
            print(f"   Error (expected): {response.json().get('detail', 'Unknown')}")
            return True
        return False
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


def test_ftp_connection_fail():
    """Test FTP connection with invalid credentials (should fail gracefully)"""
    print("\n[TEST] FTP Connection (Invalid - Expected to Fail)")
    try:
        response = requests.post(
            f"{BASE_URL}/connections/ftp",
            json={
                "host": "invalid.example.com",
                "username": "testuser",
                "password": "testpass",
                "port": 21,
                "timeout": 5
            }
        )
        print(f"✅ Status: {response.status_code}")
        if response.status_code == 400:
            print(f"   Error (expected): {response.json().get('detail', 'Unknown')}")
            return True
        return False
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


def test_disconnect_invalid():
    """Test disconnecting invalid session"""
    print("\n[TEST] Disconnect Invalid Session")
    try:
        response = requests.delete(f"{BASE_URL}/connections/invalid-session-id")
        print(f"✅ Status: {response.status_code}")
        if response.status_code == 404:
            print(f"   Error (expected): {response.json().get('detail', 'Unknown')}")
            return True
        return False
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


def test_cleanup():
    """Test session cleanup"""
    print("\n[TEST] Cleanup Expired Sessions")
    try:
        response = requests.post(f"{BASE_URL}/connections/cleanup")
        print(f"✅ Status: {response.status_code}")
        data = response.json()
        print(f"   Cleaned: {data.get('cleaned', 0)} sessions")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("CoreAstra Connection Manager - Backend Tests")
    print("=" * 60)
    print(f"Target: {BASE_URL}")
    print(f"Note: These tests verify API structure, not actual connections")
    print("=" * 60)
    
    tests = [
        test_health,
        test_root,
        test_list_empty_sessions,
        test_ssh_connection_fail,
        test_ftp_connection_fail,
        test_disconnect_invalid,
        test_cleanup
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test crashed: {e}")
            failed += 1
        sleep(0.5)  # Small delay between tests
    
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed == 0:
        print("✅ All tests passed!")
        print("\nBackend is ready for frontend integration.")
    else:
        print(f"⚠️  {failed} test(s) failed")
        print("\nCheck if backend is running: python connection_app.py")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
