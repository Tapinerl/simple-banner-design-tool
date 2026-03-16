import { useEffect, useMemo, useState } from "react";

const HEX_6 = /^#[0-9a-fA-F]{6}$/;
const HEX_3 = /^#[0-9a-fA-F]{3}$/;

const expandShortHex = (value) =>
  `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;

const normalizeHex = (value) => {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const prefixed = raw.startsWith("#") ? raw : `#${raw}`;
  if (HEX_6.test(prefixed)) {
    return prefixed.toLowerCase();
  }
  if (HEX_3.test(prefixed)) {
    return expandShortHex(prefixed).toLowerCase();
  }
  return null;
};

function ColorControl({ value, onChange, hexLabel = "HEX color", className = "", idPrefix = "color" }) {
  const safeValue = useMemo(() => normalizeHex(value) ?? "#000000", [value]);
  const [draft, setDraft] = useState(safeValue);

  useEffect(() => {
    setDraft(safeValue);
  }, [safeValue]);

  const commitHex = (nextRaw) => {
    const normalized = normalizeHex(nextRaw);
    if (!normalized) {
      return false;
    }
    if (normalized !== safeValue) {
      onChange?.(normalized);
    }
    return true;
  };

  return (
    <div className={`color-control-row ${className}`.trim()}>
      <input
        id={`${idPrefix}-picker`}
        type="color"
        value={safeValue}
        onChange={(event) => {
          const next = event.target.value.toLowerCase();
          setDraft(next);
          onChange?.(next);
        }}
      />
      <input
        id={`${idPrefix}-hex`}
        className="color-hex-input"
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        maxLength={7}
        aria-label={hexLabel}
        placeholder="#RRGGBB"
        value={draft}
        onChange={(event) => {
          const nextRaw = event.target.value;
          setDraft(nextRaw);
          commitHex(nextRaw);
        }}
        onBlur={() => {
          const committed = commitHex(draft);
          if (!committed) {
            setDraft(safeValue);
          }
        }}
      />
    </div>
  );
}

export default ColorControl;
