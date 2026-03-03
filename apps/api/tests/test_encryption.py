"""Tests for field encryption utilities."""
import pytest
from app.utils.security import encrypt_field, decrypt_field, is_encrypted


def test_encrypt_decrypt_roundtrip():
    """Encrypting then decrypting should return the original value."""
    original = "sk-test-1234567890abcdef"
    encrypted = encrypt_field(original)
    assert encrypted != original
    assert decrypt_field(encrypted) == original


def test_encrypt_produces_different_ciphertext():
    """Fernet uses a random IV, so encrypting twice gives different results."""
    original = "my-secret-key"
    e1 = encrypt_field(original)
    e2 = encrypt_field(original)
    assert e1 != e2  # different ciphertext
    # But both decrypt to the same value
    assert decrypt_field(e1) == original
    assert decrypt_field(e2) == original


def test_encrypt_empty_string():
    """Empty strings and None-like values pass through unchanged."""
    assert encrypt_field("") == ""
    assert decrypt_field("") == ""


def test_is_encrypted_true():
    """is_encrypted should detect a Fernet-encrypted value."""
    encrypted = encrypt_field("test-value")
    assert is_encrypted(encrypted) is True


def test_is_encrypted_false():
    """is_encrypted should return False for plaintext."""
    assert is_encrypted("plaintext-password") is False
    assert is_encrypted("") is False


def test_decrypt_invalid_raises():
    """Decrypting a non-Fernet string should raise an error."""
    with pytest.raises(Exception):
        decrypt_field("not-a-valid-fernet-token")


def test_long_api_key():
    """Should handle long API keys (Anthropic keys can be 100+ chars)."""
    long_key = "sk-ant-api03-" + "x" * 200
    encrypted = encrypt_field(long_key)
    assert decrypt_field(encrypted) == long_key


def test_special_characters():
    """Should handle special characters in values."""
    value = 'p@ssw0rd!#$%^&*()_+-=[]{}|;:"<>?,./~`'
    encrypted = encrypt_field(value)
    assert decrypt_field(encrypted) == value
