/**
 * @file Artifact 解析器 Hook
 * @description 封装 ArtifactParser 实例管理，用于流式解析 AI 响应
 * @module lib/artifact/hooks/useArtifactParser
 * @requirements 2.3, 11.1
 */

import { useCallback, useRef } from "react";
import { ArtifactParser, type ParserConfig, type ParseResult } from "../parser";
import type { Artifact } from "../types";
import { useArtifact } from "./useArtifact";

/**
 * 解析器 Hook 返回值接口
 */
export interface UseArtifactParserReturn {
  /**
   * 开始新的解析会话
   * 创建新的解析器实例，清除之前的状态
   */
  startParsing: () => void;

  /**
   * 追加文本块进行流式解析
   * @param chunk - 新增的文本块
   * @returns 当前解析结果，如果解析器未初始化则返回 undefined
   */
  appendChunk: (chunk: string) => ParseResult | undefined;

  /**
   * 完成解析会话
   * 处理所有剩余内容，将流式状态的 artifact 标记为完成
   * @returns 最终解析结果，如果解析器未初始化则返回 undefined
   */
  finalizeParsing: () => ParseResult | undefined;

  /**
   * 检查解析器是否处于活动状态
   */
  isActive: () => boolean;

  /**
   * 重置解析器状态
   * 清除解析器实例和所有已解析的 artifact
   */
  reset: () => void;
}

/**
 * 已知 Artifact ID 集合
 * 用于跟踪哪些 artifact 已经被添加到 store
 */
type KnownArtifactIds = Set<string>;

/**
 * Artifact 解析器 Hook
 *
 * 用于流式解析 AI 响应，自动管理解析器实例和状态更新。
 * 提供 startParsing、appendChunk、finalizeParsing 方法来控制解析流程。
 *
 * @param config - 解析器配置选项
 * @returns 解析器操作方法
 *
 * @example
 * ```tsx
 * function StreamingChat() {
 *   const { startParsing, appendChunk, finalizeParsing } = useArtifactParser();
 *
 *   const handleStreamStart = () => {
 *     startParsing();
 *   };
 *
 *   const handleStreamChunk = (chunk: string) => {
 *     const result = appendChunk(chunk);
 *     // result.artifacts 包含当前解析出的所有 artifact
 *   };
 *
 *   const handleStreamEnd = () => {
 *     const result = finalizeParsing();
 *     // result.artifacts 包含最终的所有 artifact
 *   };
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @requirements 2.3, 11.1
 */
export function useArtifactParser(
  config?: ParserConfig,
): UseArtifactParserReturn {
  // 解析器实例引用
  const parserRef = useRef<ArtifactParser | null>(null);

  // 已知 artifact ID 集合，用于区分新增和更新
  const knownIdsRef = useRef<KnownArtifactIds>(new Set());

  // 获取 artifact 操作方法
  const { addArtifact, updateArtifact } = useArtifact();

  /**
   * 处理解析结果，更新 store 中的 artifact
   * - 新 artifact: 调用 addArtifact
   * - 已存在的 artifact: 调用 updateArtifact
   */
  const processParseResult = useCallback(
    (result: ParseResult) => {
      result.artifacts.forEach((artifact) => {
        if (knownIdsRef.current.has(artifact.id)) {
          // 已存在，更新内容和状态
          updateArtifact(artifact.id, {
            content: artifact.content,
            status: artifact.status,
            position: artifact.position,
            updatedAt: artifact.updatedAt,
          });
        } else {
          // 新 artifact，添加到 store
          addArtifact(artifact);
          knownIdsRef.current.add(artifact.id);
        }
      });
    },
    [addArtifact, updateArtifact],
  );

  /**
   * 开始新的解析会话
   */
  const startParsing = useCallback(() => {
    // 创建新的解析器实例
    parserRef.current = new ArtifactParser(config);
    // 清空已知 ID 集合
    knownIdsRef.current = new Set();
  }, [config]);

  /**
   * 追加文本块进行流式解析
   */
  const appendChunk = useCallback(
    (chunk: string): ParseResult | undefined => {
      if (!parserRef.current) {
        return undefined;
      }

      const result = parserRef.current.append(chunk);

      // 处理解析结果，更新 store
      processParseResult(result);

      return result;
    },
    [processParseResult],
  );

  /**
   * 完成解析会话
   */
  const finalizeParsing = useCallback((): ParseResult | undefined => {
    if (!parserRef.current) {
      return undefined;
    }

    const result = parserRef.current.finalize();

    // 处理最终结果
    // 将所有 streaming 状态的 artifact 标记为 complete
    result.artifacts.forEach((artifact) => {
      if (knownIdsRef.current.has(artifact.id)) {
        updateArtifact(artifact.id, {
          content: artifact.content,
          status:
            artifact.status === "streaming" ? "complete" : artifact.status,
          position: artifact.position,
          updatedAt: Date.now(),
        });
      } else {
        // 最后一刻发现的新 artifact
        const finalArtifact: Artifact = {
          ...artifact,
          status:
            artifact.status === "streaming" ? "complete" : artifact.status,
        };
        addArtifact(finalArtifact);
        knownIdsRef.current.add(artifact.id);
      }
    });

    // 清理解析器实例
    parserRef.current = null;

    return result;
  }, [addArtifact, updateArtifact]);

  /**
   * 检查解析器是否处于活动状态
   */
  const isActive = useCallback((): boolean => {
    return parserRef.current !== null;
  }, []);

  /**
   * 重置解析器状态
   */
  const reset = useCallback(() => {
    if (parserRef.current) {
      parserRef.current.reset();
    }
    parserRef.current = null;
    knownIdsRef.current = new Set();
  }, []);

  return {
    startParsing,
    appendChunk,
    finalizeParsing,
    isActive,
    reset,
  };
}
