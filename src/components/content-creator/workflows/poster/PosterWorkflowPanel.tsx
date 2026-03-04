/**
 * @file PosterWorkflowPanel.tsx
 * @description 海报工作流面板组件
 * @module components/content-creator/workflows/poster/PosterWorkflowPanel
 */

import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Circle,
  Loader2,
  SkipForward,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Play,
  AlertCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePosterWorkflow } from "@/hooks/usePosterWorkflow";
import { ActivityLogList } from "@/components/content-creator/components/ActivityLog";
import type {
  WorkflowTemplate,
  WorkflowStep,
  WorkflowStepStatus,
  InputField,
  WorkflowContext,
} from "./types";

/**
 * 工作流面板属性
 */
export interface PosterWorkflowPanelProps {
  /** 项目 ID */
  projectId?: string;
  /** 品牌人设 ID */
  brandPersonaId?: string;
  /** 画布 JSON */
  canvasJson?: Record<string, unknown>;
  /** 步骤完成回调 */
  onStepComplete?: (stepId: string, result: unknown) => void;
  /** 工作流完成回调 */
  onWorkflowComplete?: (results: Map<string, unknown>) => void;
  /** 类名 */
  className?: string;
}

/**
 * 步骤状态图标
 */
function StepStatusIcon({ status }: { status: WorkflowStepStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "active":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "skipped":
      return <SkipForward className="h-5 w-5 text-gray-400" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Circle className="h-5 w-5 text-gray-300" />;
  }
}

/**
 * 工作流选择器
 */
function WorkflowSelector({
  workflows,
  onSelect,
}: {
  workflows: WorkflowTemplate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workflows.map((workflow) => (
        <Card
          key={workflow.id}
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => onSelect(workflow.id)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{workflow.name}</CardTitle>
            <CardDescription>{workflow.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {workflow.tags?.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {workflow.steps.length} 个步骤
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 步骤导航
 */
function StepNavigation({
  steps,
  currentIndex,
  getStatus,
  onStepClick,
}: {
  steps: WorkflowStep[];
  currentIndex: number;
  getStatus: (stepId: string) => WorkflowStepStatus;
  onStepClick: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, index) => {
        const status = getStatus(step.id);
        const isActive = index === currentIndex;
        const isClickable =
          status === "completed" || status === "skipped" || isActive;

        return (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <div
                className={cn(
                  "h-px w-8 flex-shrink-0",
                  status === "completed" || status === "skipped"
                    ? "bg-green-500"
                    : "bg-gray-200",
                )}
              />
            )}
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-shrink-0",
                isActive && "bg-primary/10 border border-primary",
                !isActive && isClickable && "hover:bg-muted",
                !isClickable && "opacity-50 cursor-not-allowed",
              )}
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
            >
              <StepStatusIcon status={status} />
              <span
                className={cn(
                  "text-sm font-medium",
                  isActive && "text-primary",
                )}
              >
                {step.name}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * 输入字段渲染
 */
function InputFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: InputField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <Input
          placeholder={field.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <Textarea
          placeholder={field.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      );

    case "select":
      return (
        <Select
          value={(value as string) || ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="请选择..." />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(value as string) || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded border cursor-pointer"
          />
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
      );

    default:
      return (
        <Input
          placeholder={field.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/**
 * 步骤内容面板
 */
function StepContentPanel({
  step,
  formData,
  onFormChange,
  onExecute,
  onSkip,
  isExecuting,
}: {
  step: WorkflowStep;
  formData: Record<string, unknown>;
  onFormChange: (key: string, value: unknown) => void;
  onExecute: () => void;
  onSkip: () => void;
  isExecuting: boolean;
}) {
  const hasRequiredFields = step.inputFields?.some((f) => f.required) ?? false;
  const allRequiredFilled =
    !hasRequiredFields ||
    (step.inputFields
      ?.filter((f) => f.required)
      .every((f) => formData[f.key]) ??
      true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{step.name}</CardTitle>
        <CardDescription>{step.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step.inputFields && step.inputFields.length > 0 && (
          <div className="space-y-4">
            {step.inputFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <InputFieldRenderer
                  field={field}
                  value={formData[field.key]}
                  onChange={(value) => onFormChange(field.key, value)}
                />
              </div>
            ))}
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step.optional && (
              <Button variant="ghost" size="sm" onClick={onSkip}>
                <SkipForward className="h-4 w-4 mr-1" />
                跳过此步骤
              </Button>
            )}
          </div>
          <Button
            onClick={onExecute}
            disabled={isExecuting || !allRequiredFilled}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                执行中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                执行此步骤
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 海报工作流面板
 */
export function PosterWorkflowPanel({
  projectId,
  brandPersonaId,
  canvasJson,
  onStepComplete,
  onWorkflowComplete,
  className,
}: PosterWorkflowPanelProps) {
  const {
    currentWorkflow,
    currentStepIndex,
    currentStep,
    isExecuting,
    isCompleted,
    progress,
    availableWorkflows,
    startWorkflow,
    executeCurrentStep,
    skipCurrentStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    resetWorkflow,
    getStepStatus,
  } = usePosterWorkflow();

  // 表单数据
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  // 活动日志面板展开状态
  const [showActivityLog, setShowActivityLog] = useState(false);

  // 处理表单变更
  const handleFormChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 执行当前步骤
  const handleExecute = useCallback(async () => {
    if (!currentStep) return;

    const context: WorkflowContext = {
      projectId,
      brandPersonaId,
      userInput: JSON.stringify(formData),
      canvasJson,
      extra: formData,
    };

    const result = await executeCurrentStep(context);
    if (result) {
      onStepComplete?.(currentStep.id, result);
      // 清空表单，准备下一步
      setFormData({});
      goToNextStep();
    }
  }, [
    currentStep,
    projectId,
    brandPersonaId,
    formData,
    canvasJson,
    executeCurrentStep,
    onStepComplete,
    goToNextStep,
  ]);

  // 跳过步骤
  const handleSkip = useCallback(() => {
    skipCurrentStep();
    setFormData({});
  }, [skipCurrentStep]);

  // 工作流完成处理
  React.useEffect(() => {
    if (isCompleted && onWorkflowComplete) {
      // 收集所有结果
      const results = new Map<string, unknown>();
      onWorkflowComplete(results);
    }
  }, [isCompleted, onWorkflowComplete]);

  // 未选择工作流时显示选择器
  if (!currentWorkflow) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="text-center">
          <h2 className="text-2xl font-bold">选择工作流</h2>
          <p className="text-muted-foreground mt-2">
            选择一个适合您需求的工作流模板开始创作
          </p>
        </div>
        <WorkflowSelector
          workflows={availableWorkflows}
          onSelect={startWorkflow}
        />
      </div>
    );
  }

  // 工作流完成
  if (isCompleted) {
    return (
      <div className={cn("space-y-4", className)}>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">工作流已完成</h2>
            <p className="text-muted-foreground mt-2">
              您已完成 {currentWorkflow.name} 的所有步骤
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button variant="outline" onClick={resetWorkflow}>
                <RotateCcw className="h-4 w-4 mr-2" />
                重新开始
              </Button>
              <Button onClick={() => startWorkflow("")}>选择其他工作流</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 工作流标题和进度 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{currentWorkflow.name}</h2>
          <p className="text-sm text-muted-foreground">
            步骤 {currentStepIndex + 1} / {currentWorkflow.steps.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-32">
            <Progress value={progress} className="h-2" />
          </div>
          <span className="text-sm text-muted-foreground">{progress}%</span>
          {/* 活动日志切换按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActivityLog(!showActivityLog)}
          >
            <FileText className="h-4 w-4 mr-1" />
            {showActivityLog ? '隐藏日志' : '活动日志'}
          </Button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 工作流内容 */}
        <div className={cn(
          "space-y-4",
          showActivityLog ? "lg:col-span-2" : "lg:col-span-3"
        )}>
          {/* 步骤导航 */}
          <ScrollArea className="w-full">
            <StepNavigation
              steps={currentWorkflow.steps}
              currentIndex={currentStepIndex}
              getStatus={getStepStatus}
              onStepClick={goToStep}
            />
          </ScrollArea>

          {/* 当前步骤内容 */}
          {currentStep && (
            <StepContentPanel
              step={currentStep}
              formData={formData}
              onFormChange={handleFormChange}
              onExecute={handleExecute}
              onSkip={handleSkip}
              isExecuting={isExecuting}
            />
          )}

          {/* 导航按钮 */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一步
            </Button>
            <Button variant="ghost" onClick={resetWorkflow}>
              <RotateCcw className="h-4 w-4 mr-1" />
              重置
            </Button>
            <Button
              variant="outline"
              onClick={goToNextStep}
              disabled={
                getStepStatus(currentStep?.id || "") !== "completed" &&
                getStepStatus(currentStep?.id || "") !== "skipped"
              }
            >
              下一步
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* 活动日志面板 */}
        {showActivityLog && (
          <div className="lg:col-span-1">
            <Card className="h-[600px]">
              <ActivityLogList />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default PosterWorkflowPanel;
