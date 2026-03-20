/**
 * @file 对齐辅助线工具函数
 * @description 提供对齐辅助线计算和网格吸附功能
 * @module components/content-creator/canvas/poster/utils/alignmentGuides
 */

import type { fabric } from "fabric";

/**
 * 对齐线类型
 */
export type AlignmentLineType = "horizontal" | "vertical";

/**
 * 对齐线来源
 */
export type AlignmentSource =
  | "canvas-center"
  | "element-edge"
  | "element-center";

/**
 * 对齐线信息
 */
export interface AlignmentLine {
  /** 线类型 */
  type: AlignmentLineType;
  /** 位置（水平线为 y 坐标，垂直线为 x 坐标） */
  position: number;
  /** 来源 */
  source: AlignmentSource;
  /** 关联的元素 ID（如果有） */
  elementId?: string;
}

/**
 * 对齐结果
 */
export interface AlignmentResult {
  /** 吸附后的 x 坐标 */
  x: number;
  /** 吸附后的 y 坐标 */
  y: number;
  /** 显示的对齐线 */
  lines: AlignmentLine[];
  /** 是否发生了吸附 */
  snapped: boolean;
}

/**
 * 元素边界信息
 */
export interface ElementBounds {
  /** 元素 ID */
  id: string;
  /** 左边界 */
  left: number;
  /** 上边界 */
  top: number;
  /** 右边界 */
  right: number;
  /** 下边界 */
  bottom: number;
  /** 中心 x */
  centerX: number;
  /** 中心 y */
  centerY: number;
}

/**
 * 对齐配置
 */
export interface AlignmentConfig {
  /** 吸附阈值（像素） */
  snapThreshold: number;
  /** 是否启用画布中心对齐 */
  enableCanvasCenter: boolean;
  /** 是否启用元素边缘对齐 */
  enableElementEdge: boolean;
  /** 是否启用元素中心对齐 */
  enableElementCenter: boolean;
  /** 网格大小（像素），0 表示禁用 */
  gridSize: number;
}

/**
 * 默认对齐配置
 */
export const DEFAULT_ALIGNMENT_CONFIG: AlignmentConfig = {
  snapThreshold: 5,
  enableCanvasCenter: true,
  enableElementEdge: true,
  enableElementCenter: true,
  gridSize: 0,
};

/**
 * 对齐辅助工具函数（纯函数，用于测试）
 */
export const alignmentUtils = {
  /**
   * 计算元素边界
   * @param obj Fabric.js 对象
   * @returns 元素边界信息
   */
  getElementBounds: (obj: fabric.Object): ElementBounds => {
    const bounds = obj.getBoundingRect();
    return {
      id: (obj as any).id || obj.toString(),
      left: bounds.left,
      top: bounds.top,
      right: bounds.left + bounds.width,
      bottom: bounds.top + bounds.height,
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
    };
  },

  /**
   * 获取画布中心对齐线
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   * @returns 画布中心对齐线
   */
  getCanvasCenterLines: (
    canvasWidth: number,
    canvasHeight: number,
  ): AlignmentLine[] => {
    return [
      {
        type: "vertical",
        position: canvasWidth / 2,
        source: "canvas-center",
      },
      {
        type: "horizontal",
        position: canvasHeight / 2,
        source: "canvas-center",
      },
    ];
  },

  /**
   * 获取元素对齐线
   * @param bounds 元素边界
   * @param includeCenter 是否包含中心线
   * @returns 元素对齐线
   */
  getElementAlignmentLines: (
    bounds: ElementBounds,
    includeCenter: boolean = true,
  ): AlignmentLine[] => {
    const lines: AlignmentLine[] = [
      // 边缘线
      {
        type: "vertical",
        position: bounds.left,
        source: "element-edge",
        elementId: bounds.id,
      },
      {
        type: "vertical",
        position: bounds.right,
        source: "element-edge",
        elementId: bounds.id,
      },
      {
        type: "horizontal",
        position: bounds.top,
        source: "element-edge",
        elementId: bounds.id,
      },
      {
        type: "horizontal",
        position: bounds.bottom,
        source: "element-edge",
        elementId: bounds.id,
      },
    ];

    if (includeCenter) {
      lines.push(
        {
          type: "vertical",
          position: bounds.centerX,
          source: "element-center",
          elementId: bounds.id,
        },
        {
          type: "horizontal",
          position: bounds.centerY,
          source: "element-center",
          elementId: bounds.id,
        },
      );
    }

    return lines;
  },

  /**
   * 检查是否在吸附范围内
   * @param value 当前值
   * @param target 目标值
   * @param threshold 阈值
   * @returns 是否在范围内
   */
  isWithinThreshold: (
    value: number,
    target: number,
    threshold: number,
  ): boolean => {
    return Math.abs(value - target) <= threshold;
  },

  /**
   * 吸附到网格
   * @param value 当前值
   * @param gridSize 网格大小
   * @returns 吸附后的值
   */
  snapToGrid: (value: number, gridSize: number): number => {
    if (gridSize <= 0) return value;
    const lowerGrid = Math.floor(value / gridSize) * gridSize;
    const upperGrid = Math.ceil(value / gridSize) * gridSize;
    return Math.abs(value - lowerGrid) <= Math.abs(upperGrid - value)
      ? lowerGrid
      : upperGrid;
  },

  /**
   * 计算吸附位置
   * @param movingBounds 移动元素的边界
   * @param alignmentLines 所有对齐线
   * @param config 对齐配置
   * @returns 吸附结果
   */
  calculateSnap: (
    movingBounds: ElementBounds,
    alignmentLines: AlignmentLine[],
    config: AlignmentConfig,
  ): AlignmentResult => {
    let snapX = movingBounds.centerX;
    let snapY = movingBounds.centerY;
    const activeLines: AlignmentLine[] = [];
    let snapped = false;

    // 检查垂直对齐线（影响 x 坐标）
    for (const line of alignmentLines) {
      if (line.type !== "vertical") continue;

      // 检查左边缘
      if (
        alignmentUtils.isWithinThreshold(
          movingBounds.left,
          line.position,
          config.snapThreshold,
        )
      ) {
        snapX = line.position + (movingBounds.centerX - movingBounds.left);
        activeLines.push(line);
        snapped = true;
        break;
      }
      // 检查右边缘
      if (
        alignmentUtils.isWithinThreshold(
          movingBounds.right,
          line.position,
          config.snapThreshold,
        )
      ) {
        snapX = line.position - (movingBounds.right - movingBounds.centerX);
        activeLines.push(line);
        snapped = true;
        break;
      }
      // 检查中心
      if (
        alignmentUtils.isWithinThreshold(
          movingBounds.centerX,
          line.position,
          config.snapThreshold,
        )
      ) {
        snapX = line.position;
        activeLines.push(line);
        snapped = true;
        break;
      }
    }

    // 检查水平对齐线（影响 y 坐标）
    for (const line of alignmentLines) {
      if (line.type !== "horizontal") continue;

      // 检查上边缘
      if (
        alignmentUtils.isWithinThreshold(
          movingBounds.top,
          line.position,
          config.snapThreshold,
        )
      ) {
        snapY = line.position + (movingBounds.centerY - movingBounds.top);
        activeLines.push(line);
        snapped = true;
        break;
      }
      // 检查下边缘
      if (
        alignmentUtils.isWithinThreshold(
          movingBounds.bottom,
          line.position,
          config.snapThreshold,
        )
      ) {
        snapY = line.position - (movingBounds.bottom - movingBounds.centerY);
        activeLines.push(line);
        snapped = true;
        break;
      }
      // 检查中心
      if (
        alignmentUtils.isWithinThreshold(
          movingBounds.centerY,
          line.position,
          config.snapThreshold,
        )
      ) {
        snapY = line.position;
        activeLines.push(line);
        snapped = true;
        break;
      }
    }

    // 网格吸附
    if (config.gridSize > 0) {
      const gridSnapX = alignmentUtils.snapToGrid(snapX, config.gridSize);
      const gridSnapY = alignmentUtils.snapToGrid(snapY, config.gridSize);

      // 如果网格吸附更近，使用网格吸附
      if (
        Math.abs(gridSnapX - movingBounds.centerX) <
        Math.abs(snapX - movingBounds.centerX)
      ) {
        snapX = gridSnapX;
        snapped = true;
      }
      if (
        Math.abs(gridSnapY - movingBounds.centerY) <
        Math.abs(snapY - movingBounds.centerY)
      ) {
        snapY = gridSnapY;
        snapped = true;
      }
    }

    return {
      x: snapX,
      y: snapY,
      lines: activeLines,
      snapped,
    };
  },

  /**
   * 对齐选中元素到指定方向
   * @param elements 要对齐的元素边界列表
   * @param direction 对齐方向
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   * @returns 每个元素的新位置
   */
  alignElements: (
    elements: ElementBounds[],
    direction: AlignDirection,
    canvasWidth: number,
    canvasHeight: number,
  ): Map<string, { x: number; y: number }> => {
    const result = new Map<string, { x: number; y: number }>();

    if (elements.length === 0) return result;

    switch (direction) {
      case "left": {
        const minLeft = Math.min(...elements.map((e) => e.left));
        for (const el of elements) {
          const offsetX = el.centerX - el.left;
          result.set(el.id, { x: minLeft + offsetX, y: el.centerY });
        }
        break;
      }
      case "center-horizontal": {
        const avgCenterX =
          elements.reduce((sum, e) => sum + e.centerX, 0) / elements.length;
        for (const el of elements) {
          result.set(el.id, { x: avgCenterX, y: el.centerY });
        }
        break;
      }
      case "right": {
        const maxRight = Math.max(...elements.map((e) => e.right));
        for (const el of elements) {
          const offsetX = el.right - el.centerX;
          result.set(el.id, { x: maxRight - offsetX, y: el.centerY });
        }
        break;
      }
      case "top": {
        const minTop = Math.min(...elements.map((e) => e.top));
        for (const el of elements) {
          const offsetY = el.centerY - el.top;
          result.set(el.id, { x: el.centerX, y: minTop + offsetY });
        }
        break;
      }
      case "center-vertical": {
        const avgCenterY =
          elements.reduce((sum, e) => sum + e.centerY, 0) / elements.length;
        for (const el of elements) {
          result.set(el.id, { x: el.centerX, y: avgCenterY });
        }
        break;
      }
      case "bottom": {
        const maxBottom = Math.max(...elements.map((e) => e.bottom));
        for (const el of elements) {
          const offsetY = el.bottom - el.centerY;
          result.set(el.id, { x: el.centerX, y: maxBottom - offsetY });
        }
        break;
      }
      case "canvas-center-horizontal": {
        const canvasCenterX = canvasWidth / 2;
        for (const el of elements) {
          result.set(el.id, { x: canvasCenterX, y: el.centerY });
        }
        break;
      }
      case "canvas-center-vertical": {
        const canvasCenterY = canvasHeight / 2;
        for (const el of elements) {
          result.set(el.id, { x: el.centerX, y: canvasCenterY });
        }
        break;
      }
    }

    return result;
  },

  /**
   * 验证网格吸附结果
   * @param position 位置
   * @param gridSize 网格大小
   * @returns 是否在网格点上
   */
  isOnGrid: (position: number, gridSize: number): boolean => {
    if (gridSize <= 0) return true;
    return Math.abs(position % gridSize) < 0.001;
  },

  /**
   * 验证对齐结果
   * @param elementPosition 元素位置
   * @param targetPosition 目标位置
   * @param threshold 阈值
   * @returns 是否对齐
   */
  isAligned: (
    elementPosition: number,
    targetPosition: number,
    threshold: number = 1,
  ): boolean => {
    return Math.abs(elementPosition - targetPosition) <= threshold;
  },
};

/**
 * 对齐方向
 */
export type AlignDirection =
  | "left"
  | "center-horizontal"
  | "right"
  | "top"
  | "center-vertical"
  | "bottom"
  | "canvas-center-horizontal"
  | "canvas-center-vertical";

/**
 * 对齐按钮配置
 */
export interface AlignButtonConfig {
  /** 方向 */
  direction: AlignDirection;
  /** 显示名称 */
  name: string;
  /** 图标名称 */
  icon: string;
  /** 快捷键提示 */
  shortcut?: string;
}

/**
 * 对齐按钮列表
 */
export const ALIGN_BUTTONS: AlignButtonConfig[] = [
  { direction: "left", name: "左对齐", icon: "AlignLeft" },
  {
    direction: "center-horizontal",
    name: "水平居中",
    icon: "AlignCenterHorizontal",
  },
  { direction: "right", name: "右对齐", icon: "AlignRight" },
  { direction: "top", name: "顶部对齐", icon: "AlignStartVertical" },
  {
    direction: "center-vertical",
    name: "垂直居中",
    icon: "AlignCenterVertical",
  },
  { direction: "bottom", name: "底部对齐", icon: "AlignEndVertical" },
  {
    direction: "canvas-center-horizontal",
    name: "画布水平居中",
    icon: "AlignHorizontalJustifyCenter",
  },
  {
    direction: "canvas-center-vertical",
    name: "画布垂直居中",
    icon: "AlignVerticalJustifyCenter",
  },
];
