import { Heading, Textarea } from "@particle-academy/react-fancy";

export interface SpeakerNotesProps {
    notes?: string;
    onChange: (notes: string) => void;
    placeholder?: string;
}

/**
 * Bottom-of-editor speaker notes panel. Just a labelled `Textarea` from
 * react-fancy — the rest of the editor chrome controls how much vertical
 * space this gets.
 */
export function SpeakerNotes({ notes, onChange, placeholder }: SpeakerNotesProps) {
    return (
        <div className="fs-notes border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <Heading as="h3" size="xs" className="mb-1 !uppercase !tracking-wider !text-zinc-500">
                Speaker notes
            </Heading>
            <Textarea
                value={notes ?? ""}
                onValueChange={onChange}
                placeholder={placeholder ?? "Notes are visible only to the presenter…"}
                rows={3}
                autoResize
                minRows={2}
                maxRows={6}
            />
        </div>
    );
}
