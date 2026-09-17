import { ShieldCheck, ShieldOff } from "lucide-react";
import type { ContextMenuItem } from "@/components/molecules/EditorContextMenu";
import { useTranslation } from "@/i18n";
import type { NoteEncryptionMenuAction } from "../hooks/useNoteEncryption";

type Translator = ReturnType<typeof useTranslation>["t"];

/** 详情右键菜单共用的「加密/解密」菜单项：未传入时返回空（不展示入口）。 */
export function encryptionMenuItems(encryption: NoteEncryptionMenuAction | undefined, t: Translator): ContextMenuItem[] {
  if (!encryption) return [];
  const decrypting = encryption.action === "decrypt";
  return [
    { kind: "separator", key: "encryption-separator" },
    {
      key: "encryption",
      icon: decrypting ? ShieldOff : ShieldCheck,
      label: t(decrypting ? "note.decrypt" : "note.encrypt"),
      onSelect: encryption.onSelect,
      disabled: encryption.pending,
    },
  ];
}
