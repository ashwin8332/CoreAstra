"""
CoreAstra AI Engines
AI-Powered Terminal & Intelligent Control Interface

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

import asyncio
import json
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, List, Dict, Any
from config import settings
from logger import logger

# Valid current models as of December 2024
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"  # Updated from deprecated mixtral-8x7b-32768
DEFAULT_CLAUDE_MODEL = "claude-3-haiku-20240307"
DEFAULT_OLLAMA_MODEL = "llama2"
DEFAULT_OPENAI_MODEL = "gpt-3.5-turbo"

GEMINI_MODEL_CANDIDATES = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
]

GROQ_MODEL_CANDIDATES = [
    "llama-3.3-70b-versatile",  # Latest and most capable
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",  # Deprecated but kept for backward compat
]

CLAUDE_MODEL_CANDIDATES = [
    DEFAULT_CLAUDE_MODEL,
    "claude-3-5-sonnet-20240620",
    "claude-3-sonnet-20240229",
    "claude-3-opus-20240229",
]


class RetryConfig:
    """Exponential backoff retry configuration."""
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 30.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
    
    def get_delay(self, attempt: int) -> float:
        """Calculate exponential backoff delay with jitter."""
        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        return delay


async def retry_with_backoff(coro_func, *args, retry_config: RetryConfig = None, **kwargs):
    """Execute async function with exponential backoff retry logic."""
    if retry_config is None:
        retry_config = RetryConfig()
    
    last_error = None
    for attempt in range(retry_config.max_retries):
        try:
            return await coro_func(*args, **kwargs)
        except Exception as e:
            last_error = e
            if attempt < retry_config.max_retries - 1:
                delay = retry_config.get_delay(attempt)
                logger.warning(f"Attempt {attempt + 1} failed: {str(e)}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                logger.error(f"All {retry_config.max_retries} attempts failed. Last error: {str(e)}")
    
    raise last_error


class BaseAIEngine(ABC):
    """Base class for AI engines."""
    
    def __init__(self, name: str):
        self.name = name
        self.is_available = False
        self.retry_config = RetryConfig(max_retries=3, base_delay=1.0)
        self.available_models: List[str] = []
        self.supports_custom_model: bool = True
        self.unavailable_reason: Optional[str] = "Engine not initialized"
    
    @abstractmethod
    async def initialize(self) -> bool:
        """Initialize the AI engine."""
        pass
    
    @abstractmethod
    async def chat(self, messages: List[Dict], stream: bool = False) -> AsyncGenerator[str, None]:
        """Send chat message and get response."""
        pass
    
    @abstractmethod
    async def analyze_command(self, command: str) -> Dict:
        """Analyze a command for safety and suggestions."""
        pass

    def mark_unavailable(self, reason: str) -> bool:
        """Record why initialization failed and mark engine offline."""
        self.is_available = False
        self.unavailable_reason = reason
        return False


class GeminiEngine(BaseAIEngine):
    """Google Gemini AI Engine - Disabled due to API quota/access issues."""
    
    def __init__(self):
        super().__init__("gemini")
        self.model = None
        self.model_name = None
        self.preferred_model = settings.GEMINI_MODEL_NAME
        preferred_list = [self.preferred_model] if self.preferred_model else []
        self.available_models = [
            model for model in preferred_list + GEMINI_MODEL_CANDIDATES if model
        ]
    
    async def initialize(self) -> bool:
        try:
            if not settings.GEMINI_API_KEY:
                logger.warning("Gemini API key not configured")
                return self.mark_unavailable("Gemini API key not configured")
            
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            # Try multiple model variants in order of preference
            models_to_try = []
            if self.preferred_model:
                models_to_try.append(self.preferred_model)
            models_to_try.extend(GEMINI_MODEL_CANDIDATES)
            # Remove duplicates while preserving order
            seen_models = set()
            models_to_try = [m for m in models_to_try if not (m in seen_models or seen_models.add(m))]
            self.available_models = models_to_try.copy()
            
            for model_name in models_to_try:
                try:
                    model = genai.GenerativeModel(model_name)
                    # Test with minimal request
                    response = model.generate_content(
                        "Hi",
                        generation_config={"max_output_tokens": 5}
                    )
                    self.model = model
                    self.model_name = model_name
                    self.is_available = True
                    self.unavailable_reason = None
                    logger.info(f"Gemini engine initialized with model: {self.model_name}")
                    return True
                except Exception as e:
                    error_str = str(e).lower()
                    if "quota" in error_str or "exceeded" in error_str:
                        reason = "Gemini API quota exceeded"
                        logger.warning("Gemini initialization skipped: API quota exceeded. Provide additional quota or disable the engine.")
                        return self.mark_unavailable(reason)
                    elif "401" in str(e) or "unauthorized" in error_str:
                        reason = "Gemini API key invalid or unauthorized"
                        logger.warning("Gemini initialization skipped: API key invalid or unauthorized. Update GEMINI_API_KEY in configuration.")
                        return self.mark_unavailable(reason)
                    # Continue to next model
                    continue
            
            reason = "No Gemini models passed health checks"
            logger.warning("Gemini engine unavailable: no working models passed health checks. Verify API quota and model availability.")
            return self.mark_unavailable(reason)
            
        except Exception as e:
            logger.warning(f"Failed to initialize Gemini: {str(e)}")
            return self.mark_unavailable(f"Gemini initialization failed: {str(e)}")
    
    async def chat(self, messages: List[Dict], stream: bool = False) -> AsyncGenerator[str, None]:
        if not self.model:
            yield "Gemini engine not initialized"
            return
        
        try:
            prompt = self._format_messages(messages)
            
            if stream:
                response = await asyncio.to_thread(
                    self.model.generate_content,
                    prompt,
                    stream=True
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
            else:
                response = await retry_with_backoff(
                    asyncio.to_thread,
                    self.model.generate_content,
                    prompt,
                    retry_config=self.retry_config
                )
                yield response.text
        except Exception as e:
            logger.error(f"Gemini chat error: {str(e)}")
            yield f"Error: {str(e)}"
    
    async def analyze_command(self, command: str) -> Dict:
        if not self.model:
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Gemini not initialized"}
        
        prompt = f"""Analyze this terminal command for safety and provide suggestions:
Command: {command}

Respond ONLY in valid JSON format (no markdown, no extra text):
{{
    "is_safe": true/false,
    "risk_level": "low/medium/high/critical",
    "explanation": "...",
    "suggestions": ["..."]
}}"""
        
        try:
            response = await retry_with_backoff(
                asyncio.to_thread,
                self.model.generate_content,
                prompt,
                retry_config=self.retry_config
            )
            return json.loads(response.text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Gemini JSON response")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}
        except Exception as e:
            logger.error(f"Gemini analyze_command error: {str(e)}")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}
    
    def _format_messages(self, messages: List[Dict]) -> str:
        formatted = []
        for msg in messages:
            role = msg.get("role", "user").capitalize()
            content = msg.get("content", "")
            formatted.append(f"{role}: {content}")
        return "\n".join(formatted)


class GroqEngine(BaseAIEngine):
    """Groq AI Engine - Disabled due to invalid API key in configuration."""
    
    def __init__(self):
        super().__init__("groq")
        self.client = None
        self.model_name = settings.GROQ_MODEL_NAME or DEFAULT_GROQ_MODEL
        self.available_models = list(dict.fromkeys([
            self.model_name,
            *GROQ_MODEL_CANDIDATES,
        ]))
    
    async def initialize(self) -> bool:
        try:
            if not settings.GROQ_API_KEY:
                logger.warning("Groq API key not configured")
                return self.mark_unavailable("Groq API key not configured")

            self.available_models = list(dict.fromkeys([
                self.model_name,
                *GROQ_MODEL_CANDIDATES,
            ]))
            
            from groq import Groq
            
            # Validate API key format
            if not settings.GROQ_API_KEY.startswith("gsk_"):
                logger.warning("Groq initialization skipped: API key must start with 'gsk_'. Update GROQ_API_KEY in configuration.")
                return self.mark_unavailable("Groq API key must start with 'gsk_'")
            
            # Use sync client for testing, then async
            test_client = Groq(api_key=settings.GROQ_API_KEY)
            
            try:
                test_response = test_client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=10
                )
                # If test passed, create async client
                from groq import AsyncGroq
                self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
                self.is_available = True
                self.unavailable_reason = None
                logger.info(f"Groq engine initialized successfully with model: {self.model_name}")
                return True
            except Exception as api_err:
                error_str = str(api_err)
                if "401" in error_str or "invalid api key" in error_str.lower():
                    logger.warning("Groq initialization skipped: API key invalid or expired. Refresh GROQ_API_KEY to enable this engine.")
                    return self.mark_unavailable("Groq API key invalid or expired")
                logger.warning(f"Groq API test failed: {error_str[:100]}")
                return self.mark_unavailable("Groq API test failed")
        except Exception as e:
            logger.warning(f"Failed to initialize Groq: {str(e)}")
            return self.mark_unavailable(f"Groq initialization failed: {str(e)}")
    
    async def chat(self, messages: List[Dict], stream: bool = False) -> AsyncGenerator[str, None]:
        if not self.client:
            yield "Groq engine not initialized"
            return
        
        try:
            if stream:
                response = await retry_with_backoff(
                    self.client.chat.completions.create,
                    model=self.model_name,
                    messages=messages,
                    stream=True,
                    retry_config=self.retry_config
                )
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            else:
                response = await retry_with_backoff(
                    self.client.chat.completions.create,
                    model=self.model_name,
                    messages=messages,
                    retry_config=self.retry_config
                )
                yield response.choices[0].message.content
        except Exception as e:
            logger.error(f"Groq chat error: {str(e)}")
            yield f"Error: {str(e)}"
    
    async def analyze_command(self, command: str) -> Dict:
        if not self.client:
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Groq not initialized"}
        
        messages = [{
            "role": "system",
            "content": "You are a system command analyzer. Respond ONLY in valid JSON format, no markdown or extra text."
        }, {
            "role": "user",
            "content": f"""Analyze this terminal command for safety:
Command: {command}

Respond in JSON: {{"is_safe": bool, "risk_level": "low/medium/high/critical", "explanation": "...", "suggestions": [...]}}"""
        }]
        
        try:
            response = await retry_with_backoff(
                self.client.chat.completions.create,
                model=self.model_name,
                messages=messages,
                retry_config=self.retry_config
            )
            return json.loads(response.choices[0].message.content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Groq JSON response")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}
        except Exception as e:
            logger.error(f"Groq analyze_command error: {str(e)}")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}


class ClaudeEngine(BaseAIEngine):
    """Anthropic Claude AI Engine - Uses working claude-3-haiku model."""
    
    def __init__(self):
        super().__init__("claude")
        self.client = None
        self.model_name = settings.CLAUDE_MODEL_NAME or DEFAULT_CLAUDE_MODEL  # Verified working model
        self.available_models = list(dict.fromkeys([
            self.model_name,
            *CLAUDE_MODEL_CANDIDATES,
        ]))
    
    async def initialize(self) -> bool:
        try:
            if not settings.ANTHROPIC_API_KEY:
                logger.warning("Anthropic API key not configured")
                return self.mark_unavailable("Anthropic API key not configured")
            
            from anthropic import AsyncAnthropic  # type: ignore
            
            self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            self.available_models = list(dict.fromkeys([
                self.model_name,
                *CLAUDE_MODEL_CANDIDATES,
            ]))
            
            # Test API connectivity with minimal request
            try:
                response = await self.client.messages.create(
                    model=self.model_name,
                    max_tokens=10,
                    messages=[{"role": "user", "content": "hi"}]
                )
                self.is_available = True
                self.unavailable_reason = None
                logger.info(f"Claude engine initialized successfully with model: {self.model_name}")
                return True
            except Exception as model_err:
                error_str = str(model_err)
                if "404" in error_str or "not found" in error_str.lower():
                    logger.warning(f"Claude model '{self.model_name}' not found or unavailable")
                    return self.mark_unavailable("Claude model not found or unavailable")
                elif "401" in error_str or "unauthorized" in error_str.lower():
                    logger.warning("Claude API key invalid or unauthorized")
                    return self.mark_unavailable("Claude API key invalid or unauthorized")
                logger.warning(f"Claude initialization failed: {error_str[:100]}")
                return self.mark_unavailable("Claude initialization request failed")
        except Exception as e:
            logger.warning(f"Failed to initialize Claude: {str(e)}")
            return self.mark_unavailable(f"Claude initialization failed: {str(e)}")
    
    async def chat(self, messages: List[Dict], stream: bool = False) -> AsyncGenerator[str, None]:
        if not self.client:
            yield "Claude engine not initialized"
            return
        
        try:
            # Extract system message if present
            system_msg = ""
            chat_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_msg = msg["content"]
                else:
                    chat_messages.append(msg)
            
            if stream:
                response = await retry_with_backoff(
                    self.client.messages.stream,
                    model=self.model_name,
                    max_tokens=4096,
                    system=system_msg if system_msg else "You are a helpful AI assistant.",
                    messages=chat_messages,
                    retry_config=self.retry_config
                )
                async with response as stream:
                    async for text in stream.text_stream:
                        yield text
            else:
                response = await retry_with_backoff(
                    self.client.messages.create,
                    model=self.model_name,
                    max_tokens=4096,
                    system=system_msg if system_msg else "You are a helpful AI assistant.",
                    messages=chat_messages,
                    retry_config=self.retry_config
                )
                yield response.content[0].text
        except Exception as e:
            logger.error(f"Claude chat error: {str(e)}")
            yield f"Error: {str(e)}"
    
    async def analyze_command(self, command: str) -> Dict:
        if not self.client:
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Claude not initialized"}
        
        try:
            response = await retry_with_backoff(
                self.client.messages.create,
                model=self.model_name,
                max_tokens=1024,
                system="You are a system command analyzer. Respond ONLY in valid JSON format.",
                messages=[{
                    "role": "user",
                    "content": f"""Analyze this terminal command for safety:
Command: {command}

Respond in JSON: {{"is_safe": bool, "risk_level": "low/medium/high/critical", "explanation": "...", "suggestions": [...]}}"""
                }],
                retry_config=self.retry_config
            )
            return json.loads(response.content[0].text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Claude JSON response")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}
        except Exception as e:
            logger.error(f"Claude analyze_command error: {str(e)}")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}


class OpenAIEngine(BaseAIEngine):
    """OpenAI GPT Engine with proper async support."""
    
    def __init__(self):
        super().__init__("openai")
        self.client = None
        self.model_name = settings.OPENAI_MODEL_NAME or DEFAULT_OPENAI_MODEL
        self.available_models = [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-4",
            "gpt-3.5-turbo",
        ]
    
    async def initialize(self) -> bool:
        try:
            if not settings.OPENAI_API_KEY:
                logger.warning("OpenAI API key not configured")
                return self.mark_unavailable("OpenAI API key not configured")
            
            from openai import AsyncOpenAI
            
            # Validate API key format (OpenAI keys start with 'sk-')
            if not settings.OPENAI_API_KEY.startswith("sk-"):
                logger.warning("OpenAI initialization skipped: API key must start with 'sk-'. Update OPENAI_API_KEY in configuration.")
                return self.mark_unavailable("OpenAI API key must start with 'sk-'")
            
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            
            # Test API connectivity with minimal request
            try:
                test_response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=10
                )
                self.is_available = True
                self.unavailable_reason = None
                logger.info(f"OpenAI engine initialized successfully with model: {self.model_name}")
                return True
            except Exception as api_err:
                error_str = str(api_err)
                if "401" in error_str or "invalid api key" in error_str.lower() or "incorrect api key" in error_str.lower():
                    logger.warning("OpenAI initialization skipped: API key invalid or expired. Refresh OPENAI_API_KEY to enable this engine.")
                    return self.mark_unavailable("OpenAI API key invalid or expired")
                elif "404" in error_str or "model" in error_str.lower() and "not found" in error_str.lower():
                    logger.warning(f"OpenAI model '{self.model_name}' not found or unavailable")
                    return self.mark_unavailable("OpenAI model not found or unavailable")
                logger.warning(f"OpenAI API test failed: {error_str[:100]}")
                return self.mark_unavailable("OpenAI API test failed")
        except Exception as e:
            logger.warning(f"Failed to initialize OpenAI: {str(e)}")
            return self.mark_unavailable(f"OpenAI initialization failed: {str(e)}")
    
    async def chat(self, messages: List[Dict], stream: bool = False) -> AsyncGenerator[str, None]:
        if not self.client:
            yield "OpenAI engine not initialized"
            return
        
        try:
            if stream:
                response = await retry_with_backoff(
                    self.client.chat.completions.create,
                    model=self.model_name,
                    messages=messages,
                    stream=True,
                    retry_config=self.retry_config
                )
                async for chunk in response:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            else:
                response = await retry_with_backoff(
                    self.client.chat.completions.create,
                    model=self.model_name,
                    messages=messages,
                    retry_config=self.retry_config
                )
                yield response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI chat error: {str(e)}")
            yield f"Error: {str(e)}"
    
    async def analyze_command(self, command: str) -> Dict:
        if not self.client:
            return {"is_safe": True, "risk_level": "unknown", "explanation": "OpenAI not initialized"}
        
        messages = [{
            "role": "system",
            "content": "You are a system command analyzer. Respond ONLY in valid JSON format, no markdown or extra text."
        }, {
            "role": "user",
            "content": f"""Analyze this terminal command for safety:
Command: {command}

Respond in JSON: {{"is_safe": bool, "risk_level": "low/medium/high/critical", "explanation": "...", "suggestions": [...]}}"""
        }]
        
        try:
            response = await retry_with_backoff(
                self.client.chat.completions.create,
                model=self.model_name,
                messages=messages,
                retry_config=self.retry_config
            )
            return json.loads(response.choices[0].message.content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse OpenAI JSON response")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}
        except Exception as e:
            logger.error(f"OpenAI analyze_command error: {str(e)}")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}


class OllamaEngine(BaseAIEngine):
    """Ollama Local AI Engine with model detection."""
    
    def __init__(self):
        super().__init__("ollama")
        self.client = None
        self.model = settings.OLLAMA_DEFAULT_MODEL or DEFAULT_OLLAMA_MODEL
        self.preferred_model = settings.OLLAMA_DEFAULT_MODEL
        self.available_models = []
    
    async def initialize(self) -> bool:
        try:
            import ollama  # type: ignore
            # Use sync client since ollama library is synchronous
            self.client = ollama.Client(host=settings.OLLAMA_HOST)
            
            # Check if Ollama is running and list available models
            try:
                models_response = self.client.list()
                available_models = models_response.get("models", [])
                self.available_models = [
                    m["name"] for m in available_models if m.get("name")
                ]
                
                if available_models:
                    if self.preferred_model:
                        preferred = next(
                            (m["name"] for m in available_models if m["name"] == self.preferred_model),
                            None
                        )
                        self.model = preferred or available_models[0]["name"]
                    else:
                        self.model = available_models[0]["name"]
                    self.is_available = True
                    self.unavailable_reason = None
                    logger.info(f"Ollama engine initialized with model: {self.model}")
                    logger.info(f"Available models: {[m['name'] for m in available_models]}")
                    return True
                else:
                    logger.warning("Ollama is running but no models available. Pull a model first.")
                    self.available_models = []
                    return self.mark_unavailable("Ollama running but no models available")
            except Exception as e:
                logger.warning(f"Ollama connection failed: {str(e)}. Is Ollama running at {settings.OLLAMA_HOST}?")
                self.available_models = []
                return self.mark_unavailable("Unable to reach Ollama host")
        except Exception as e:
            logger.warning(f"Ollama not available: {str(e)}")
            self.available_models = []
            return self.mark_unavailable(f"Ollama not available: {str(e)}")
    
    async def chat(self, messages: List[Dict], stream: bool = False) -> AsyncGenerator[str, None]:
        if not self.client:
            yield "Ollama engine not initialized"
            return
        
        try:
            # Use sync methods since ollama library is synchronous
            if stream:
                response = self.client.chat(
                    model=self.model,
                    messages=messages,
                    stream=True
                )
                # Ollama streaming returns a generator
                for chunk in response:
                    if chunk.get("message", {}).get("content"):
                        yield chunk["message"]["content"]
            else:
                response = self.client.chat(
                    model=self.model,
                    messages=messages
                )
                yield response["message"]["content"]
        except Exception as e:
            logger.error(f"Ollama chat error: {str(e)}")
            yield f"Error: {str(e)}"
    
    async def analyze_command(self, command: str) -> Dict:
        if not self.client:
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Ollama not initialized"}
        
        messages = [{
            "role": "system",
            "content": "You are a system command analyzer. Respond ONLY in valid JSON format, no markdown or extra text."
        }, {
            "role": "user",
            "content": f"""Analyze this terminal command for safety:
Command: {command}

Respond in JSON: {{"is_safe": bool, "risk_level": "low/medium/high/critical", "explanation": "...", "suggestions": [...]}}"""
        }]
        
        try:
            response = await retry_with_backoff(
                self.client.chat,
                model=self.model,
                messages=messages,
                retry_config=self.retry_config
            )
            return json.loads(response["message"]["content"])
        except json.JSONDecodeError:
            logger.warning("Failed to parse Ollama JSON response")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}
        except Exception as e:
            logger.error(f"Ollama analyze_command error: {str(e)}")
            return {"is_safe": True, "risk_level": "unknown", "explanation": "Analysis unavailable"}


class AIEngineManager:
    """Manages multiple AI engines with fallback logic and health monitoring."""
    
    def __init__(self):
        self.engines: Dict[str, BaseAIEngine] = {}
        self.default_engine: Optional[str] = None
    
    async def initialize(self):
        """Initialize all AI engines with detailed logging."""
        logger.info("Initializing AI engines...")
        
        # Register engines
        self.engines["gemini"] = GeminiEngine()
        self.engines["groq"] = GroqEngine()
        self.engines["claude"] = ClaudeEngine()
        self.engines["openai"] = OpenAIEngine()
        self.engines["ollama"] = OllamaEngine()
        
        # Initialize all engines (failures should not crash the app)
        for name, engine in self.engines.items():
            try:
                result = await engine.initialize()
                if result:
                    logger.info(f"{name.capitalize()} engine: [OK]")
                else:
                    reason = engine.unavailable_reason or "Unavailable"
                    logger.warning(f"{name.capitalize()} engine: [UNAVAILABLE] - {reason}")
            except Exception as e:
                logger.error(f"{name.capitalize()} engine: [FAILED] - {str(e)}")
                engine.mark_unavailable(f"Initialization exception: {str(e)}")
        
        # Set default engine with preference order
        preferred_order = [settings.DEFAULT_AI_ENGINE, "openai", "ollama", "groq", "gemini", "claude"]
        
        for engine_name in preferred_order:
            if engine_name in self.engines and self.engines[engine_name].is_available:
                self.default_engine = engine_name
                logger.info(f"[OK] Default AI engine set to: {engine_name}")
                break
        
        if not self.default_engine:
            available = self.get_available_engines()
            if available:
                self.default_engine = available[0]
                logger.warning(f"Preferred engine unavailable. Using fallback: {self.default_engine}")
            else:
                logger.error("[ERROR] No AI engine available! Configure at least one API key.")
    
    def get_engine(self, name: Optional[str] = None) -> Optional[BaseAIEngine]:
        """Get an AI engine by name or return default."""
        if name and name in self.engines and self.engines[name].is_available:
            return self.engines[name]
        
        if self.default_engine and self.default_engine in self.engines:
            return self.engines[self.default_engine]
        
        return None
    
    def get_available_engines(self) -> List[str]:
        """Get list of available engine names."""
        return [name for name, engine in self.engines.items() if engine.is_available]

    def refresh_default_engine(self):
        """Ensure default engine points to an available engine."""
        if self.default_engine and self.default_engine in self.engines:
            if self.engines[self.default_engine].is_available:
                return
        self.default_engine = None
        available = self.get_available_engines()
        if available:
            self.default_engine = available[0]
    
    async def chat(self, messages: List[Dict], engine: Optional[str] = None, stream: bool = False) -> AsyncGenerator[str, None]:
        """Chat with specified or default engine."""
        ai_engine = self.get_engine(engine)
        if not ai_engine:
            yield "No AI engine available. Please configure at least one AI provider."
            return
        
        async for chunk in ai_engine.chat(messages, stream):
            yield chunk
    
    async def analyze_command(self, command: str, engine: Optional[str] = None) -> Dict:
        """Analyze command with specified or default engine."""
        ai_engine = self.get_engine(engine)
        if not ai_engine:
            return {"is_safe": True, "risk_level": "unknown", "explanation": "No AI engine available"}
        
        return await ai_engine.analyze_command(command)

    async def update_engine_config(
        self,
        engine_name: str,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        model_provided: bool = False,
    ) -> Dict[str, Any]:
        """Update credentials or model configuration for a specific engine."""
        engine_key = engine_name.lower()
        if engine_key not in self.engines:
            raise ValueError(f"Unknown engine: {engine_name}")
        engine = self.engines[engine_key]

        previous_api: Optional[str] = None
        previous_model_setting: Optional[str] = None
        previous_preferred = getattr(engine, "preferred_model", None)
        previous_engine_model = getattr(engine, "model_name", None)
        previous_available = list(engine.available_models) if getattr(engine, "available_models", None) else []

        if engine_key == "gemini":
            previous_api = getattr(settings, "GEMINI_API_KEY", None)
            previous_model_setting = getattr(settings, "GEMINI_MODEL_NAME", None)
            if api_key is not None:
                object.__setattr__(settings, "GEMINI_API_KEY", api_key or None)
            if model_provided:
                object.__setattr__(settings, "GEMINI_MODEL_NAME", model_name or None)
                engine.preferred_model = model_name or None
            engine.model = None
            engine.model_name = None
            preferred_list = [engine.preferred_model] if engine.preferred_model else []
            engine.available_models = [
                model for model in preferred_list + GEMINI_MODEL_CANDIDATES if model
            ]
        elif engine_key == "groq":
            previous_api = getattr(settings, "GROQ_API_KEY", None)
            previous_model_setting = getattr(settings, "GROQ_MODEL_NAME", DEFAULT_GROQ_MODEL)
            if api_key is not None:
                object.__setattr__(settings, "GROQ_API_KEY", api_key or None)
            if model_provided:
                if model_name:
                    object.__setattr__(settings, "GROQ_MODEL_NAME", model_name)
                    engine.model_name = model_name
                else:
                    object.__setattr__(settings, "GROQ_MODEL_NAME", DEFAULT_GROQ_MODEL)
                    engine.model_name = DEFAULT_GROQ_MODEL
            engine.available_models = list(
                dict.fromkeys(
                    filter(None, [engine.model_name, *GROQ_MODEL_CANDIDATES])
                )
            )
        elif engine_key == "claude":
            previous_api = getattr(settings, "ANTHROPIC_API_KEY", None)
            previous_model_setting = getattr(settings, "CLAUDE_MODEL_NAME", DEFAULT_CLAUDE_MODEL)
            if api_key is not None:
                object.__setattr__(settings, "ANTHROPIC_API_KEY", api_key or None)
            if model_provided:
                if model_name:
                    object.__setattr__(settings, "CLAUDE_MODEL_NAME", model_name)
                    engine.model_name = model_name
                else:
                    object.__setattr__(settings, "CLAUDE_MODEL_NAME", DEFAULT_CLAUDE_MODEL)
                    engine.model_name = DEFAULT_CLAUDE_MODEL
            engine.available_models = list(
                dict.fromkeys(
                    filter(None, [engine.model_name, *CLAUDE_MODEL_CANDIDATES])
                )
            )
        elif engine_key == "ollama":
            previous_model_setting = getattr(settings, "OLLAMA_DEFAULT_MODEL", None)
            if model_provided:
                if model_name:
                    object.__setattr__(settings, "OLLAMA_DEFAULT_MODEL", model_name)
                    engine.preferred_model = model_name
                else:
                    object.__setattr__(settings, "OLLAMA_DEFAULT_MODEL", None)
                    engine.preferred_model = None
            engine.model = engine.preferred_model or engine.model
        elif engine_key == "openai":
            previous_api = getattr(settings, "OPENAI_API_KEY", None)
            previous_model_setting = getattr(settings, "OPENAI_MODEL_NAME", DEFAULT_OPENAI_MODEL)
            if api_key is not None:
                object.__setattr__(settings, "OPENAI_API_KEY", api_key or None)
            if model_provided:
                if model_name:
                    object.__setattr__(settings, "OPENAI_MODEL_NAME", model_name)
                    engine.model_name = model_name
                else:
                    object.__setattr__(settings, "OPENAI_MODEL_NAME", DEFAULT_OPENAI_MODEL)
                    engine.model_name = DEFAULT_OPENAI_MODEL
            engine.client = None  # Reset client to force reinitialization
        else:
            raise ValueError(f"Engine '{engine_name}' does not accept configuration updates")

        engine.is_available = False
        reinit_result = await engine.initialize()

        credentials_attempted = (api_key is not None) or model_provided
        if not reinit_result and credentials_attempted:
            logger.error(
                f"Failed to initialize {engine_key} engine with provided configuration. Restoring previous settings."
            )

            failed_reason = engine.unavailable_reason
            if engine_key == "gemini":
                object.__setattr__(settings, "GEMINI_API_KEY", previous_api)
                object.__setattr__(settings, "GEMINI_MODEL_NAME", previous_model_setting)
                engine.preferred_model = previous_preferred
                engine.model = None
                engine.model_name = previous_engine_model
            elif engine_key == "groq":
                object.__setattr__(settings, "GROQ_API_KEY", previous_api)
                object.__setattr__(settings, "GROQ_MODEL_NAME", previous_model_setting or DEFAULT_GROQ_MODEL)
                engine.model_name = previous_engine_model or previous_model_setting or DEFAULT_GROQ_MODEL
            elif engine_key == "claude":
                object.__setattr__(settings, "ANTHROPIC_API_KEY", previous_api)
                object.__setattr__(settings, "CLAUDE_MODEL_NAME", previous_model_setting or DEFAULT_CLAUDE_MODEL)
                engine.model_name = previous_engine_model or previous_model_setting or DEFAULT_CLAUDE_MODEL
            elif engine_key == "ollama":
                object.__setattr__(settings, "OLLAMA_DEFAULT_MODEL", previous_model_setting)
                engine.preferred_model = previous_preferred
                engine.model = previous_preferred or engine.model
            elif engine_key == "openai":
                object.__setattr__(settings, "OPENAI_API_KEY", previous_api)
                object.__setattr__(settings, "OPENAI_MODEL_NAME", previous_model_setting or DEFAULT_OPENAI_MODEL)
                engine.model_name = previous_engine_model or previous_model_setting or DEFAULT_OPENAI_MODEL
                engine.client = None

            engine.is_available = False
            engine.available_models = previous_available
            await engine.initialize()
            self.refresh_default_engine()
            raise ValueError(
                f"Failed to initialize {engine_key.capitalize()} with the provided configuration. Previous configuration restored."
                + (f" Reason: {failed_reason}" if failed_reason else "")
            )

        if reinit_result and not self.default_engine:
            self.default_engine = engine_key
        self.refresh_default_engine()

        return {
            "engine": engine_key,
            "is_available": engine.is_available,
            "model_name": getattr(engine, "model_name", getattr(engine, "preferred_model", None)),
            "default_engine": self.default_engine,
            "available_models": engine.available_models,
            "supports_custom_model": getattr(engine, "supports_custom_model", True),
            "reason": engine.unavailable_reason,
        }


# Global AI manager instance
ai_manager = AIEngineManager()
