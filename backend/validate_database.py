"""
Database Validation Script
Tests that all models are properly created and settings can be stored.
"""

import asyncio
from sqlalchemy import text
from database import init_db, AsyncSessionLocal
from models import AIModelConfig, SystemSettings


async def validate_database():
    """Validate database schema and test basic operations."""
    print("🔍 Validating CoreAstra Database Setup...")
    print("-" * 60)
    
    # Initialize database
    print("\n1. Initializing database...")
    await init_db()
    print("   ✅ Database initialized successfully")
    
    # Check tables exist
    print("\n2. Checking database tables...")
    async with AsyncSessionLocal() as db:
        # Check AIModelConfig table
        result = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_model_configs'"))
        if result.scalar():
            print("   ✅ ai_model_configs table exists")
        else:
            print("   ❌ ai_model_configs table NOT found")
            return False
        
        # Check SystemSettings table
        result = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'"))
        if result.scalar():
            print("   ✅ system_settings table exists")
        else:
            print("   ❌ system_settings table NOT found")
            return False
    
    # Test AI model config creation
    print("\n3. Testing AI model config storage...")
    async with AsyncSessionLocal() as db:
        # Create test config
        test_config = AIModelConfig(
            engine_name="test_engine",
            api_key="test_key_12345",
            model_name="test_model",
            base_url="https://test.api.com",
            is_enabled=True,
            is_custom=True,
            settings={"temperature": 0.7, "max_tokens": 2048}
        )
        db.add(test_config)
        await db.commit()
        print("   ✅ Test AI config created")
        
        # Verify it was saved
        from sqlalchemy import select
        result = await db.execute(
            select(AIModelConfig).where(AIModelConfig.engine_name == "test_engine")
        )
        saved_config = result.scalar_one_or_none()
        
        if saved_config:
            print(f"   ✅ Config retrieved: {saved_config.engine_name}")
            print(f"      - API Key: {saved_config.api_key[:10]}...")
            print(f"      - Model: {saved_config.model_name}")
            print(f"      - Settings: {saved_config.settings}")
            
            # Clean up test data
            await db.delete(saved_config)
            await db.commit()
            print("   ✅ Test data cleaned up")
        else:
            print("   ❌ Failed to retrieve saved config")
            return False
    
    # Test system settings storage
    print("\n4. Testing system settings storage...")
    async with AsyncSessionLocal() as db:
        # Create test setting
        test_setting = SystemSettings(
            setting_key="test.temperature",
            setting_value={"value": 0.8},
            setting_type="ai",
            description="Test temperature setting"
        )
        db.add(test_setting)
        await db.commit()
        print("   ✅ Test system setting created")
        
        # Verify it was saved
        from sqlalchemy import select
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.setting_key == "test.temperature")
        )
        saved_setting = result.scalar_one_or_none()
        
        if saved_setting:
            print(f"   ✅ Setting retrieved: {saved_setting.setting_key}")
            print(f"      - Type: {saved_setting.setting_type}")
            print(f"      - Value: {saved_setting.setting_value}")
            
            # Clean up test data
            await db.delete(saved_setting)
            await db.commit()
            print("   ✅ Test data cleaned up")
        else:
            print("   ❌ Failed to retrieve saved setting")
            return False
    
    print("\n" + "=" * 60)
    print("✅ All database validations passed!")
    print("=" * 60)
    print("\nDatabase is ready to store:")
    print("  • AI engine API keys")
    print("  • Model configurations")
    print("  • System settings")
    print("  • User preferences")
    print("\n🚀 CoreAstra database is fully functional!")
    return True


if __name__ == "__main__":
    success = asyncio.run(validate_database())
    exit(0 if success else 1)
