"""
Caching utility for search results using Redis (optional).
Falls back to no-op caching if Redis is unavailable.
"""

import json
from typing import Optional, Any
from datetime import timedelta
import hashlib


class CacheManager:
    """
    Simple cache manager with Redis support (optional).
    If Redis is unavailable, caching is skipped.
    """
    
    def __init__(self, redis_client=None, ttl_seconds: int = 3600):
        """
        Initialize cache manager.
        
        Args:
            redis_client: Optional redis.StrictRedis instance
            ttl_seconds: Time-to-live for cached items (default 1 hour)
        """
        self.redis = redis_client
        self.ttl = timedelta(seconds=ttl_seconds)
    
    def _generate_key(self, prefix: str, query: str, category_id: Optional[str] = None) -> str:
        """Generate cache key from query and category."""
        key_parts = [prefix, query]
        if category_id:
            key_parts.append(category_id)
        key_str = "|".join(key_parts)
        # Use hash to keep key length reasonable
        return f"cache:{hashlib.md5(key_str.encode()).hexdigest()}"
    
    def get(self, prefix: str, query: str, category_id: Optional[str] = None) -> Optional[Any]:
        """
        Retrieve item from cache.
        
        Args:
            prefix: Cache prefix (e.g., "search", "process-list")
            query: Search query
            category_id: Optional category ID
        
        Returns:
            Cached value or None if not cached or Redis unavailable
        """
        if not self.redis:
            return None
        
        try:
            key = self._generate_key(prefix, query, category_id)
            cached = self.redis.get(key)
            if cached:
                return json.loads(cached)
        except Exception:
            # Silently fail if Redis has issues
            pass
        
        return None
    
    def set(self, prefix: str, query: str, value: Any, category_id: Optional[str] = None) -> None:
        """
        Store item in cache.
        
        Args:
            prefix: Cache prefix (e.g., "search", "process-list")
            query: Search query
            value: Value to cache
            category_id: Optional category ID
        """
        if not self.redis:
            return
        
        try:
            key = self._generate_key(prefix, query, category_id)
            self.redis.setex(
                key,
                self.ttl,
                json.dumps(value, default=str)
            )
        except Exception:
            # Silently fail if Redis has issues
            pass
    
    def clear_pattern(self, pattern: str) -> None:
        """Clear cache entries matching pattern."""
        if not self.redis:
            return
        
        try:
            for key in self.redis.scan_iter(f"cache:{pattern}*"):
                self.redis.delete(key)
        except Exception:
            pass


# Global cache manager instance (initialized as no-op by default)
_cache_manager: Optional[CacheManager] = None


def get_cache_manager() -> CacheManager:
    """Get global cache manager instance."""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager


def init_cache_manager(redis_client, ttl_seconds: int = 3600) -> None:
    """Initialize cache manager with Redis client."""
    global _cache_manager
    _cache_manager = CacheManager(redis_client, ttl_seconds)
