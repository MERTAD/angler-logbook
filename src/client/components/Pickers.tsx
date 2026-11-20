import { Check } from "lucide-react";
import { ICON_COMPONENTS } from "@/client/lib/icons";
import { colorOf } from "@/client/components/WorldMap";
import { COLORS, ICONS, type ColorKey, type IconKey } from "@/lib/catalog";

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: IconKey;
  color: ColorKey;
  onChange: (icon: IconKey) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1.5">
      {ICONS.map((key) => {
        const { icon: Icon, label } = ICON_COMPONENTS[key];
        const picked = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={label}
            title={label}
            data-testid={`icon-option-${key}`}
            onClick={() => onChange(key)}
            className={`flex size-9 items-center justify-center rounded-lg border transition-colors ${picked ? "border-transparent text-background" : "border-border text-muted-foreground hover:bg-muted"}`}
            style={picked ? { backgroundColor: colorOf(color) } : undefined}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: ColorKey;
  onChange: (color: ColorKey) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {(Object.keys(COLORS) as ColorKey[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={key === value}
          aria-label={COLORS[key].label}
          title={COLORS[key].label}
          data-testid={`color-option-${key}`}
          onClick={() => onChange(key)}
          className="flex size-7 items-center justify-center rounded-full border-2 border-background text-background ring-1 ring-border"
          style={{ backgroundColor: COLORS[key].token }}
        >
          {key === value ? <Check className="size-4" aria-hidden /> : null}
        </button>
      ))}
    </div>
  );
}
