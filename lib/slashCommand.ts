import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import SlashMenu, { type SlashMenuHandle } from "@/components/SlashMenu";
import { slashItems, type SlashItem } from "@/lib/slashItems";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        items: ({ query }: { query: string }) =>
          slashItems.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
        command: ({ editor, range, props }: any) => {
          (props as SlashItem).command({ editor, range });
        },
        render: () => {
          let component: ReactRenderer<SlashMenuHandle>;
          let popup: TippyInstance[];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashMenu, {
                props: { items: props.items, command: (item: SlashItem) => props.command(item) },
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                offset: [0, 8],
                theme: "strata",
                arrow: false,
              });
            },
            onUpdate(props: any) {
              component.updateProps({ items: props.items, command: (item: SlashItem) => props.command(item) });
              if (!props.clientRect) return;
              popup[0]?.setProps({ getReferenceClientRect: props.clientRect });
            },
            onKeyDown(props: any) {
              if (props.event.key === "Escape") {
                popup[0]?.hide();
                return true;
              }
              return component.ref?.onKeyDown(props) ?? false;
            },
            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
