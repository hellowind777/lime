/**
 * 编辑器工具栏
 *
 * TipTap 编辑器的格式化工具栏
 */

import React from "react";
import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

export function EditorToolbar({ editor, className }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b border-slate-200/80 bg-white/70 px-4 py-4 backdrop-blur-sm lg:px-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">编辑工具</div>
          <div className="text-xs leading-5 text-slate-500">
            快速切换常用格式，保持章节排版和结构一致。
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarGroup label="历史">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="撤销"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="重做"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup label="文本">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="加粗"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="斜体"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="删除线"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="行内代码"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup label="标题">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="标题 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="标题 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="标题 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup label="列表">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="无序列表"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="有序列表"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup label="结构">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="引用"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="分隔线"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>
      </div>
    </div>
  );
}

interface ToolbarGroupProps {
  label: string;
  children: React.ReactNode;
}

function ToolbarGroup({ label, children }: ToolbarGroupProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 p-1 pr-2 shadow-sm shadow-slate-950/5">
      <span className="pl-2 text-[11px] font-medium text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

// 工具栏按钮组件
interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        active && "bg-slate-900 text-white hover:bg-slate-800 hover:text-white",
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}
