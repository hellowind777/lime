//! 响应缓存能力适配层
//!
//! 复用 aster-rust 中的通用实现，避免本地重复维护。

pub use aster::network::{
    CachedHttpResponse, ResponseCacheConfig, ResponseCacheStats, ResponseCacheStore,
};
