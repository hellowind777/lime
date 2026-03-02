//! 能力路由指标适配层
//!
//! 复用 aster-rust 中的通用实现，避免本地重复维护。

pub use aster::network::{
    CapabilityFilterExcludedReason, CapabilityRoutingMetricsSnapshot, CapabilityRoutingMetricsStore,
};
