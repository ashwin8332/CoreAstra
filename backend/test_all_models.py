"""
Comprehensive test script to verify ALL AI models and their working status.
Tests all 4 AI engines with different models to determine which ones work.
"""
import asyncio
import sys
import json
from datetime import datetime

sys.path.insert(0, '.')

from config import settings
from logger import logger


class AIModelTester:
    """Comprehensive AI model tester."""
    
    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "gemini": {"status": "NOT TESTED", "models": {}},
            "groq": {"status": "NOT TESTED", "models": {}},
            "claude": {"status": "NOT TESTED", "models": {}},
            "ollama": {"status": "NOT TESTED", "models": {}},
        }
    
    async def test_gemini(self):
        """Test Google Gemini models."""
        print("\n" + "="*70)
        print("TESTING GOOGLE GEMINI MODELS")
        print("="*70)
        
        try:
            import google.generativeai as genai
            
            if not settings.GEMINI_API_KEY:
                print("❌ GEMINI: No API key configured in .env")
                self.results["gemini"]["status"] = "SKIPPED - No API key"
                return
            
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            # Test multiple Gemini models
            models_to_test = [
                "gemini-pro",
                "gemini-1.5-flash",
                "gemini-1.5-pro",
                "gemini-2.0-flash",
                "gemini-2.0-flash-exp",
            ]
            
            working_models = []
            
            for model_name in models_to_test:
                print(f"\n  Testing: {model_name}")
                try:
                    model = genai.GenerativeModel(model_name)
                    response = model.generate_content(
                        "Say 'Hello' in one word",
                        generation_config={"max_output_tokens": 5}
                    )
                    print(f"    ✅ WORKING - Response: {response.text[:50]}...")
                    working_models.append(model_name)
                    self.results["gemini"]["models"][model_name] = {
                        "status": "WORKING",
                        "response_sample": response.text[:100]
                    }
                    
                except Exception as e:
                    error_str = str(e)
                    if "429" in error_str or "quota" in error_str.lower():
                        print(f"    ⚠️  QUOTA EXCEEDED - Daily limit reached")
                        self.results["gemini"]["models"][model_name] = {
                            "status": "QUOTA_EXCEEDED",
                            "error": "API quota exceeded"
                        }
                    elif "404" in error_str or "not found" in error_str.lower():
                        print(f"    ❌ NOT FOUND - Model not available")
                        self.results["gemini"]["models"][model_name] = {
                            "status": "NOT_FOUND",
                            "error": "Model not found"
                        }
                    elif "401" in error_str or "invalid" in error_str.lower():
                        print(f"    ❌ INVALID KEY - Authentication failed")
                        self.results["gemini"]["status"] = "AUTH_FAILED"
                        return
                    else:
                        print(f"    ❌ ERROR: {error_str[:80]}")
                        self.results["gemini"]["models"][model_name] = {
                            "status": "ERROR",
                            "error": error_str[:200]
                        }
            
            if working_models:
                self.results["gemini"]["status"] = f"PARTIALLY_WORKING ({len(working_models)} of {len(models_to_test)})"
                print(f"\n  Summary: {len(working_models)}/{len(models_to_test)} models working")
                print(f"  Working models: {', '.join(working_models)}")
            else:
                self.results["gemini"]["status"] = "ALL_FAILED"
                print(f"\n  Summary: No working models found")
                
        except Exception as e:
            print(f"❌ GEMINI: Initialization failed: {str(e)}")
            self.results["gemini"]["status"] = "INIT_FAILED"
    
    async def test_groq(self):
        """Test Groq models."""
        print("\n" + "="*70)
        print("TESTING GROQ MODELS")
        print("="*70)
        
        try:
            from groq import Groq
            
            if not settings.GROQ_API_KEY:
                print("❌ GROQ: No API key configured in .env")
                self.results["groq"]["status"] = "SKIPPED - No API key"
                return
            
            if not settings.GROQ_API_KEY.startswith("gsk_"):
                print("❌ GROQ: Invalid API key format (should start with 'gsk_')")
                self.results["groq"]["status"] = "INVALID_KEY_FORMAT"
                return
            
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            # Test multiple Groq models
            models_to_test = [
                "mixtral-8x7b-32768",
                "gemma-7b-it",
                "llama3-70b-8192",
                "llama3-8b-8192",
            ]
            
            working_models = []
            
            for model_name in models_to_test:
                print(f"\n  Testing: {model_name}")
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[{"role": "user", "content": "Say 'Hello' in one word"}],
                        max_tokens=10
                    )
                    print(f"    ✅ WORKING - Response: {response.choices[0].message.content[:50]}...")
                    working_models.append(model_name)
                    self.results["groq"]["models"][model_name] = {
                        "status": "WORKING",
                        "response_sample": response.choices[0].message.content[:100]
                    }
                    
                except Exception as e:
                    error_str = str(e)
                    if "401" in error_str or "invalid api key" in error_str.lower():
                        print(f"    ❌ INVALID API KEY")
                        self.results["groq"]["status"] = "AUTH_FAILED"
                        print(f"\n  Summary: Authentication failed - check API key in .env")
                        return
                    elif "429" in error_str or "rate limit" in error_str.lower():
                        print(f"    ⚠️  RATE LIMITED")
                        self.results["groq"]["models"][model_name] = {
                            "status": "RATE_LIMITED",
                            "error": "Rate limit exceeded"
                        }
                    elif "not found" in error_str.lower():
                        print(f"    ❌ NOT FOUND - Model not available")
                        self.results["groq"]["models"][model_name] = {
                            "status": "NOT_FOUND",
                            "error": "Model not found"
                        }
                    else:
                        print(f"    ❌ ERROR: {error_str[:80]}")
                        self.results["groq"]["models"][model_name] = {
                            "status": "ERROR",
                            "error": error_str[:200]
                        }
            
            if working_models:
                self.results["groq"]["status"] = f"PARTIALLY_WORKING ({len(working_models)} of {len(models_to_test)})"
                print(f"\n  Summary: {len(working_models)}/{len(models_to_test)} models working")
                print(f"  Working models: {', '.join(working_models)}")
            else:
                self.results["groq"]["status"] = "ALL_FAILED"
                print(f"\n  Summary: No working models found")
                
        except Exception as e:
            print(f"❌ GROQ: Initialization failed: {str(e)}")
            self.results["groq"]["status"] = "INIT_FAILED"
    
    async def test_claude(self):
        """Test Anthropic Claude models."""
        print("\n" + "="*70)
        print("TESTING ANTHROPIC CLAUDE MODELS")
        print("="*70)
        
        try:
            from anthropic import Anthropic
            
            if not settings.ANTHROPIC_API_KEY:
                print("❌ CLAUDE: No API key configured in .env")
                self.results["claude"]["status"] = "SKIPPED - No API key"
                return
            
            client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            
            # Test multiple Claude models
            models_to_test = [
                "claude-3-5-sonnet-20241022",
                "claude-3-haiku-20240307",
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
            ]
            
            working_models = []
            
            for model_name in models_to_test:
                print(f"\n  Testing: {model_name}")
                try:
                    response = client.messages.create(
                        model=model_name,
                        max_tokens=10,
                        messages=[{"role": "user", "content": "Say 'Hello' in one word"}]
                    )
                    print(f"    ✅ WORKING - Response: {response.content[0].text[:50]}...")
                    working_models.append(model_name)
                    self.results["claude"]["models"][model_name] = {
                        "status": "WORKING",
                        "response_sample": response.content[0].text[:100]
                    }
                    
                except Exception as e:
                    error_str = str(e)
                    if "401" in error_str or "invalid api key" in error_str.lower() or "unauthorized" in error_str.lower():
                        print(f"    ❌ INVALID API KEY")
                        self.results["claude"]["status"] = "AUTH_FAILED"
                        print(f"\n  Summary: Authentication failed - check API key in .env")
                        return
                    elif "404" in error_str or "not found" in error_str.lower():
                        print(f"    ❌ NOT FOUND - Model not available")
                        self.results["claude"]["models"][model_name] = {
                            "status": "NOT_FOUND",
                            "error": "Model not found"
                        }
                    elif "429" in error_str or "overloaded" in error_str.lower():
                        print(f"    ⚠️  OVERLOADED/RATE LIMITED")
                        self.results["claude"]["models"][model_name] = {
                            "status": "RATE_LIMITED",
                            "error": "Service overloaded or rate limited"
                        }
                    else:
                        print(f"    ❌ ERROR: {error_str[:80]}")
                        self.results["claude"]["models"][model_name] = {
                            "status": "ERROR",
                            "error": error_str[:200]
                        }
            
            if working_models:
                self.results["claude"]["status"] = f"PARTIALLY_WORKING ({len(working_models)} of {len(models_to_test)})"
                print(f"\n  Summary: {len(working_models)}/{len(models_to_test)} models working")
                print(f"  Working models: {', '.join(working_models)}")
            else:
                self.results["claude"]["status"] = "ALL_FAILED"
                print(f"\n  Summary: No working models found")
                
        except Exception as e:
            print(f"❌ CLAUDE: Initialization failed: {str(e)}")
            self.results["claude"]["status"] = "INIT_FAILED"
    
    async def test_ollama(self):
        """Test Ollama local models."""
        print("\n" + "="*70)
        print("TESTING OLLAMA LOCAL MODELS")
        print("="*70)
        
        try:
            import ollama
            
            if not settings.OLLAMA_HOST:
                print("❌ OLLAMA: No host configured in .env")
                self.results["ollama"]["status"] = "SKIPPED - No host configured"
                return
            
            print(f"  Connecting to: {settings.OLLAMA_HOST}")
            client = ollama.Client(host=settings.OLLAMA_HOST)
            
            try:
                # List available models
                models_response = client.list()
                available_models = models_response.get("models", [])
                
                if not available_models:
                    print("  ⚠️  OLLAMA: Running but no models available")
                    print("  To fix: Run `ollama pull llama2` or another model")
                    self.results["ollama"]["status"] = "RUNNING_NO_MODELS"
                    return
                
                print(f"  Found {len(available_models)} available models:")
                
                working_models = []
                
                for model_info in available_models:
                    model_name = model_info["name"]
                    print(f"\n  Testing: {model_name}")
                    try:
                        response = client.chat(
                            model=model_name,
                            messages=[{"role": "user", "content": "Say 'Hello' in one word"}]
                        )
                        print(f"    ✅ WORKING - Response: {response['message']['content'][:50]}...")
                        working_models.append(model_name)
                        self.results["ollama"]["models"][model_name] = {
                            "status": "WORKING",
                            "response_sample": response['message']['content'][:100]
                        }
                        
                    except Exception as e:
                        print(f"    ❌ ERROR: {str(e)[:80]}")
                        self.results["ollama"]["models"][model_name] = {
                            "status": "ERROR",
                            "error": str(e)[:200]
                        }
                
                if working_models:
                    self.results["ollama"]["status"] = f"WORKING ({len(working_models)} of {len(available_models)})"
                    print(f"\n  Summary: {len(working_models)}/{len(available_models)} models working")
                    print(f"  Working models: {', '.join(working_models)}")
                else:
                    self.results["ollama"]["status"] = "ALL_FAILED"
                    print(f"\n  Summary: Ollama running but no models responding")
                    
            except Exception as e:
                print(f"  ❌ OLLAMA: Connection failed - Is Ollama running?")
                print(f"     Error: {str(e)}")
                self.results["ollama"]["status"] = "CONNECTION_FAILED"
                
        except Exception as e:
            print(f"❌ OLLAMA: Import or initialization failed: {str(e)}")
            self.results["ollama"]["status"] = "INIT_FAILED"
    
    async def run_all_tests(self):
        """Run all tests."""
        print("\n\n")
        print("#" * 70)
        print("# COMPREHENSIVE AI MODEL TEST SUITE")
        print("# Testing all 4 AI engines with their respective models")
        print("#" * 70)
        
        await self.test_gemini()
        await self.test_groq()
        await self.test_claude()
        await self.test_ollama()
        
        self.print_summary()
        self.save_results()
    
    def print_summary(self):
        """Print comprehensive summary."""
        print("\n\n" + "="*70)
        print("COMPREHENSIVE TEST SUMMARY")
        print("="*70)
        
        for engine_name, engine_data in self.results.items():
            if engine_name == "timestamp":
                continue
            
            print(f"\n{engine_name.upper()}:")
            print(f"  Status: {engine_data['status']}")
            
            if engine_data["models"]:
                print(f"  Models tested: {len(engine_data['models'])}")
                for model_name, model_data in engine_data["models"].items():
                    status_symbol = "✅" if model_data["status"] == "WORKING" else "❌"
                    print(f"    {status_symbol} {model_name}: {model_data['status']}")
        
        print("\n" + "="*70)
        print("RECOMMENDATIONS:")
        print("="*70)
        
        # Count working engines
        working_engines = []
        for engine_name, engine_data in self.results.items():
            if engine_name == "timestamp":
                continue
            if "WORKING" in engine_data["status"]:
                working_engines.append(engine_name)
        
        print(f"\n✅ Working engines: {', '.join(working_engines) if working_engines else 'NONE'}")
        
        if "gemini" in working_engines:
            print("   - Gemini is working and recommended as primary backup")
        else:
            print("   - Gemini: Not working (quota exceeded, invalid key, or model not found)")
        
        if "groq" in working_engines:
            print("   - Groq is working and recommended as primary backup")
        else:
            print("   - Groq: Not working (check API key in .env)")
        
        if "claude" in working_engines:
            print("   - Claude is working and recommended as primary backup")
        else:
            print("   - Claude: Not working (check API key in .env)")
        
        if "ollama" in working_engines:
            print("   - Ollama is working perfectly (local, no API key needed)")
        else:
            print("   - Ollama: Not working (ensure Ollama is running and models are installed)")
        
        print("\n" + "-"*70)
        print("CONFIGURATION:")
        print("-"*70)
        print(f"  Gemini API Key configured: {'YES' if settings.GEMINI_API_KEY else 'NO'}")
        print(f"  Groq API Key configured: {'YES' if settings.GROQ_API_KEY else 'NO'}")
        print(f"  Anthropic API Key configured: {'YES' if settings.ANTHROPIC_API_KEY else 'NO'}")
        print(f"  Ollama Host: {settings.OLLAMA_HOST}")
        print(f"  Default Engine: {settings.DEFAULT_AI_ENGINE}")
        
        print("\n" + "-"*70)
        print("NEXT STEPS:")
        print("-"*70)
        
        if not working_engines:
            print("  ⚠️  CRITICAL: No AI engines working!")
            print("     1. Verify Ollama is installed and running (for local mode)")
            print("     2. Verify all API keys are valid in backend/.env")
            print("     3. Check internet connection for cloud APIs")
        elif len(working_engines) == 1:
            print(f"  ⚠️  Only {working_engines[0]} is working.")
            print("     Consider adding backup APIs for redundancy.")
        else:
            print(f"  ✅ Multiple engines working: {', '.join(working_engines)}")
            print("     System has good redundancy and fallback options.")
        
        print("\n")
    
    def save_results(self):
        """Save results to JSON file."""
        try:
            with open("test_results.json", "w") as f:
                json.dump(self.results, f, indent=2)
            print(f"✅ Results saved to: test_results.json")
        except Exception as e:
            print(f"❌ Failed to save results: {e}")


async def main():
    """Main entry point."""
    tester = AIModelTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
