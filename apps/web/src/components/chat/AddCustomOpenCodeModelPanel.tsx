// FILE: AddCustomOpenCodeModelPanel.tsx
// Purpose: Inline add-model form for the composer model picker (OpenCode providerID/modelID).
// Layer: Chat composer presentation

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useCustomOpenCodeModelEditor } from "~/hooks/useCustomOpenCodeModelEditor";
import { PlusIcon } from "~/lib/icons";

type AddCustomOpenCodeModelPanelProps = {
  onAdded?: (slug: string) => void;
};

export function AddCustomOpenCodeModelPanel(props: AddCustomOpenCodeModelPanelProps) {
  const editor = useCustomOpenCodeModelEditor();

  const handleAdd = () => {
    const slug = editor.addModel();
    if (slug) {
      props.onAdded?.(slug);
    }
  };

  return (
    <div className="space-y-2 border-t border-[color:var(--color-border)] px-2 py-2">
      <p className="px-1 text-[11px] leading-5 text-muted-foreground">
        添加自定义模型（providerID/modelID），无需先连接提供商。
      </p>
      <div className="flex flex-col gap-2">
        <Input
          size="sm"
          variant="soft"
          value={editor.input}
          onChange={(event) => {
            editor.setInput(event.target.value);
            if (editor.error) {
              editor.clearError();
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }
            event.preventDefault();
            handleAdd();
          }}
          placeholder={editor.example}
          spellCheck={false}
          aria-label="自定义模型代号"
        />
        <Button type="button" size="xs" variant="outline" className="w-full" onClick={handleAdd}>
          <PlusIcon className="size-3.5" />
          添加模型
        </Button>
      </div>
      {editor.error ? <p className="px-1 text-xs text-destructive">{editor.error}</p> : null}
    </div>
  );
}
