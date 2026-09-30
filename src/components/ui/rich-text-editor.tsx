import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import MathExtension from '@aarkue/tiptap-math-extension';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Undo, 
  Redo,
  Quote,
  ImageIcon,
  Sigma,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import 'katex/dist/katex.min.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  onImageUpload?: (file: File) => Promise<string>;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Tulis konten di sini...", 
  className,
  minHeight = "200px",
  onImageUpload 
}: RichTextEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-md max-w-full h-auto',
        },
      }),
      MathExtension.configure({
        evaluation: false, // Just render, don't try to evaluate
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none p-4 focus:outline-none cursor-text',
        style: `min-height: ${minHeight};`,
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;

    try {
      setIsUploading(true);
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const insertMath = () => {
    // Insert a block or inline math
    editor.chain().focus().insertContent('$$ $$').run();
  };

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children,
    title,
    disabled = false
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "h-8 w-8 p-0 rounded-lg transition-colors shrink-0",
        isActive && "bg-primary/10 text-primary"
      )}
    >
      {children}
    </Button>
  );

  return (
    <div className={cn("border border-border rounded-xl overflow-hidden bg-background flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {onImageUpload && (
          <>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            <ToolbarButton
              onClick={() => fileInputRef.current?.click()}
              title="Insert Image"
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </ToolbarButton>
          </>
        )}

        <ToolbarButton
          onClick={insertMath}
          title="Insert Math (LaTeX)"
        >
          <Sigma className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .tiptap h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .tiptap ul, .tiptap ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .tiptap ul {
          list-style-type: disc;
        }
        .tiptap ol {
          list-style-type: decimal;
        }
        .tiptap blockquote {
          border-left: 3px solid hsl(var(--primary));
          padding-left: 1rem;
          margin: 0.5rem 0;
          font-style: italic;
          color: hsl(var(--muted-foreground));
        }
        .tiptap p {
          margin-bottom: 0.5rem;
        }
        .tiptap img {
          max-width: 100%;
          height: auto;
          display: inline-block;
          border-radius: 0.375rem;
        }
        .tiptap img.ProseMirror-selectednode {
          outline: 2px solid hsl(var(--primary));
        }
        /* Style for math extension */
        .tiptap .math-node {
          display: inline-block;
          background: hsl(var(--muted));
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-family: monospace;
          color: hsl(var(--foreground));
        }
      `}</style>
    </div>
  );
}
