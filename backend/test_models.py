"""Test script to verify which AI models actually work with provided credentials."""
import asyncio
import sys
sys.path.insert(0, '.')

from config import settings
from logger import logger


async def test_gemini():
    """Test Gemini API with different models."""
    print("\n" + "="*60)
    print("TESTING GEMINI MODELS")
    print("="*60)
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Try different models
        models_to_try = [
            "gemini-pro",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-2.0-flash",
            "models/gemini-pro",
            "models/gemini-1.5-flash",
            "models/gemini-1.5-pro",
        ]
        
        for model_name in models_to_try:
            try:
                print(f"\nTesting model: {model_name}")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content("Hello", generation_config={"max_output_tokens": 5})
                print(f"  ✅ SUCCESS: {model_name}")
                print(f"     Response: {response.text[:50]}...")
                return model_name
            except Exception as e:
                error_msg = str(e)
                if "404" in error_msg or "not found" in error_msg.lower():
                    print(f"  ❌ NOT FOUND: {model_name}")
                elif "API key" in error_msg or "credentials" in error_msg.lower():
                    print(f"  ⚠️  API KEY ERROR")
                    return None
                else:
                    print(f"  ❌ ERROR: {error_msg[:80]}")
    except Exception as e:
        print(f"❌ Gemini initialization failed: {str(e)}")
    
    return None


async def test_groq():
    """Test Groq API."""
    print("\n" + "="*60)
    print("TESTING GROQ")
    print("="*60)
    
    try:
        from groq import Groq
        
        client = Groq(api_key=settings.GROQ_API_KEY)
        print(f"\nTesting Groq API key format: {settings.GROQ_API_KEY[:10]}...")
        
        response = client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10
        )
        print(f"  ✅ SUCCESS: Groq API works")
        print(f"     Response: {response.choices[0].message.content[:50]}")
        return True
    except Exception as e:
        print(f"  ❌ ERROR: {str(e)[:100]}")
        return False


async def test_claude():
    """Test Claude API."""
    print("\n" + "="*60)
    print("TESTING CLAUDE MODELS")
    print("="*60)
    
    try:
        from anthropic import Anthropic
        
        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        
        # Try different models
        models_to_try = [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
        ]
        
        for model_name in models_to_try:
            try:
                print(f"\nTesting model: {model_name}")
                response = client.messages.create(
                    model=model_name,
                    max_tokens=10,
                    messages=[{"role": "user", "content": "Hi"}]
                )
                print(f"  ✅ SUCCESS: {model_name}")
                print(f"     Response: {response.content[0].text[:50]}")
                return model_name
            except Exception as e:
                error_msg = str(e)
                if "404" in error_msg or "not found" in error_msg.lower():
                    print(f"  ❌ NOT FOUND: {model_name}")
                elif "api_key" in error_msg.lower() or "401" in error_msg:
                    print(f"  ⚠️  API KEY ERROR")
                    return None
                else:
                    print(f"  ❌ ERROR: {error_msg[:80]}")
    except Exception as e:
        print(f"❌ Claude initialization failed: {str(e)[:100]}")
    
    return None


async def test_ollama():
    """Test Ollama API."""
    print("\n" + "="*60)
    print("TESTING OLLAMA")
    print("="*60)
    
    try:
        import ollama
        
        client = ollama.Client(host=settings.OLLAMA_HOST)
        models = client.list()
        
        print(f"\n✅ Ollama is running at {settings.OLLAMA_HOST}")
        print(f"   Available models:")
        for model in models.get("models", []):
            print(f"     - {model['name']}")
        
        return True
    except Exception as e:
        print(f"  ❌ ERROR: {str(e)}")
        return False


async def main():
    print("\n" + "#"*60)
    print("# COREASTRA AI MODELS - VERIFICATION TEST")
    print("#"*60)
    
    gemini_model = await test_gemini()
    groq_works = await test_groq()
    claude_model = await test_claude()
    ollama_works = await test_ollama()
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Gemini:  {'✅ ' + gemini_model if gemini_model else '❌ NOT WORKING'}")
    print(f"Groq:    {'✅ WORKING' if groq_works else '❌ NOT WORKING'}")
    print(f"Claude:  {'✅ ' + claude_model if claude_model else '❌ NOT WORKING'}")
    print(f"Ollama:  {'✅ WORKING' if ollama_works else '❌ NOT WORKING'}")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
