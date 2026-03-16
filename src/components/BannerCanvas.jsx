import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ColorControl from "./ColorControl";

const TEXT_PADDING = 24;
const MIN_ARM_SIZE = 20;
const MAX_ARM_SIZE = 98;
const MIN_ARM_THICKNESS = 2;
const MAX_ARM_THICKNESS = 96;
const EDGE_DETECT_PX = 12;
const MIN_FONT_SIZE = 18;
const MAX_FONT_SIZE = 110;
const MIN_FONT_WEIGHT = 100;
const MAX_FONT_WEIGHT = 900;
const FONT_FAMILY_OPTIONS = [
  { label: "Trebuchet", value: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Verdana", value: 'Verdana, Geneva, sans-serif' },
  { label: "Arial", value: 'Arial, Helvetica, sans-serif' },
  { label: "Courier", value: '"Courier New", Courier, monospace' }
];

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const limitToThreeLines = (value) => value.split(/\r?\n/).slice(0, 3).join("\n");

const getArmValues = (box) => {
  const hLength = box?.hLength ?? box?.size ?? 50;
  const vLength = box?.vLength ?? box?.size ?? 50;
  const hThickness = box?.hThickness ?? box?.thickness ?? 10;
  const vThickness = box?.vThickness ?? box?.thickness ?? 10;

  return {
    hLength,
    vLength,
    hThickness,
    vThickness
  };
};

const getLocalFromCorner = (corner, clientX, clientY, rect) => {
  if (corner === "topLeft") {
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
  if (corner === "topRight") {
    return { x: rect.right - clientX, y: clientY - rect.top };
  }
  if (corner === "bottomLeft") {
    return { x: clientX - rect.left, y: rect.bottom - clientY };
  }
  return { x: rect.right - clientX, y: rect.bottom - clientY };
};

const getOpposingCenterRegion = (boxes, width, height) => {
  const hasTrBl = boxes.topRight?.enabled && boxes.bottomLeft?.enabled;
  const hasTlBr = boxes.topLeft?.enabled && boxes.bottomRight?.enabled;

  if (hasTrBl) {
    const tr = getArmValues(boxes.topRight);
    const bl = getArmValues(boxes.bottomLeft);
    const trPoint = {
      // Concave inner corner of top-right L
      x: width - (tr.vThickness / 100) * width,
      y: (tr.hThickness / 100) * height
    };
    const blPoint = {
      // Concave inner corner of bottom-left L
      x: (bl.vThickness / 100) * width,
      y: height - (bl.hThickness / 100) * height
    };

    const left = Math.min(trPoint.x, blPoint.x);
    const right = Math.max(trPoint.x, blPoint.x);
    const top = Math.min(trPoint.y, blPoint.y);
    const bottom = Math.max(trPoint.y, blPoint.y);
    return { left, right, top, bottom };
  }

  if (hasTlBr) {
    const tl = getArmValues(boxes.topLeft);
    const br = getArmValues(boxes.bottomRight);
    const tlPoint = {
      // Concave inner corner of top-left L
      x: (tl.vThickness / 100) * width,
      y: (tl.hThickness / 100) * height
    };
    const brPoint = {
      // Concave inner corner of bottom-right L
      x: width - (br.vThickness / 100) * width,
      y: height - (br.hThickness / 100) * height
    };

    const left = Math.min(tlPoint.x, brPoint.x);
    const right = Math.max(tlPoint.x, brPoint.x);
    const top = Math.min(tlPoint.y, brPoint.y);
    const bottom = Math.max(tlPoint.y, brPoint.y);
    return { left, right, top, bottom };
  }

  return { left: 0, right: width, top: 0, bottom: height };
};

function BannerCanvas({
  aspectRatio,
  backgroundColor,
  backgroundImage,
  backgroundImageScale,
  backgroundImageOffsetX,
  backgroundImageOffsetY,
  textValue,
  onTextChange,
  textColor,
  onTextColorChange,
  fontSize,
  onFontSizeChange,
  fontWeight,
  onFontWeightChange,
  fontFamily,
  onFontFamilyChange,
  boxes,
  onBoxChange,
  boxColor,
  cornerRadius
}) {
  const canvasRef = useRef(null);
  const textEditorRef = useRef(null);
  const dragRef = useRef(null);
  const [hoverState, setHoverState] = useState({ corner: null, mode: "size" });
  const [selectedCorner, setSelectedCorner] = useState(null);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const activeCorner = selectedCorner;

  const [textLayout, setTextLayout] = useState({
    left: null,
    top: null,
    width: null,
    height: null
  });

  const [ratioWidth, ratioHeight] = aspectRatio.split("/").map((value) => Number(value.trim()));
  const ratioNumber = ratioWidth && ratioHeight ? ratioWidth / ratioHeight : 16 / 9;

  const canvasStyle = { backgroundColor };

  const innerRadiusStyle = (corner) => {
    const radius = `${cornerRadius}px`;
    const none = {
      borderTopLeftRadius: "0",
      borderTopRightRadius: "0",
      borderBottomLeftRadius: "0",
      borderBottomRightRadius: "0"
    };

    // Round only the corner that does not touch canvas edges.
    if (corner === "topLeft") {
      return { ...none, borderBottomRightRadius: radius };
    }
    if (corner === "topRight") {
      return { ...none, borderBottomLeftRadius: radius };
    }
    if (corner === "bottomLeft") {
      return { ...none, borderTopRightRadius: radius };
    }
    return { ...none, borderTopLeftRadius: radius };
  };

  const armStyle = (corner) => ({
    ...innerRadiusStyle(corner),
    backgroundColor: boxColor
  });

  const sizingStyle =
    ratioNumber >= 1
      ? { width: "min(100%, 760px)" }
      : { height: "min(100%, calc(100dvh - 210px))", width: "auto", maxWidth: "100%" };

  const placeEditorCaretToEnd = (node) => {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const updateTextSizing = useCallback(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) {
      return;
    }

    const { width: canvasWidth, height: canvasHeight } = canvasNode.getBoundingClientRect();
    const region = getOpposingCenterRegion(boxes, canvasWidth, canvasHeight);

    const rawLeft = Math.min(region.left, region.right);
    const rawTop = Math.min(region.top, region.bottom);
    const rawWidth = Math.max(1, Math.abs(region.right - region.left));
    const rawHeight = Math.max(1, Math.abs(region.bottom - region.top));
    const paddingX = Math.min(TEXT_PADDING, Math.max(0, rawWidth / 2 - 1));
    const paddingY = Math.min(TEXT_PADDING, Math.max(0, rawHeight / 2 - 1));

    const left = Math.round(rawLeft + paddingX);
    const top = Math.round(rawTop + paddingY);
    const width = Math.max(1, Math.round(rawWidth - paddingX * 2));
    const height = Math.max(1, Math.round(rawHeight - paddingY * 2));

    setTextLayout({
      left,
      top,
      width,
      height
    });
  }, [boxes]);

  useLayoutEffect(() => {
    updateTextSizing();
  }, [updateTextSizing, textValue, aspectRatio]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !canvasRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateTextSizing();
    });
    resizeObserver.observe(canvasRef.current);

    return () => resizeObserver.disconnect();
  }, [updateTextSizing]);

  useEffect(() => {
    if (!isTextEditing || !textEditorRef.current) {
      return;
    }

    textEditorRef.current.innerText = textValue ?? "";
    textEditorRef.current.focus();
    placeEditorCaretToEnd(textEditorRef.current);
  }, [isTextEditing]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragRef.current || !canvasRef.current || !onBoxChange) {
        return;
      }

      const { corner, field, axis } = dragRef.current;
      const box = boxes[corner];
      if (!box?.enabled) {
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const local = getLocalFromCorner(corner, event.clientX, event.clientY, rect);

      if (field === "hLength" || field === "vLength") {
        const minLength = MIN_ARM_SIZE;
        const nextLength =
          axis === "x"
            ? clamp(Math.round((local.x / rect.width) * 100), minLength, MAX_ARM_SIZE)
            : clamp(Math.round((local.y / rect.height) * 100), minLength, MAX_ARM_SIZE);
        onBoxChange(corner, field, nextLength);
      } else {
        const nextThickness =
          axis === "x"
            ? clamp(Math.round((local.x / rect.width) * 100), MIN_ARM_THICKNESS, MAX_ARM_THICKNESS)
            : clamp(Math.round((local.y / rect.height) * 100), MIN_ARM_THICKNESS, MAX_ARM_THICKNESS);
        onBoxChange(corner, field, nextThickness);
      }
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [boxes, onBoxChange]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!canvasRef.current) {
        return;
      }

      if (!canvasRef.current.contains(event.target)) {
        setSelectedCorner(null);
        setHoverState({ corner: null, mode: "size" });
        setIsTextEditing(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const getDragIntent = (corner, event) => {
    if (!canvasRef.current) {
      return { mode: "length", axis: "x", field: "hLength" };
    }

    const box = boxes[corner];
    if (!box?.enabled) {
      return { mode: "length", axis: "x", field: "hLength" };
    }
    const arms = getArmValues(box);

    const rect = canvasRef.current.getBoundingClientRect();
    const local = getLocalFromCorner(corner, event.clientX, event.clientY, rect);
    const hLengthPx = (arms.hLength / 100) * rect.width;
    const vLengthPx = (arms.vLength / 100) * rect.height;
    const hThicknessPx = (arms.hThickness / 100) * rect.height;
    const vThicknessPx = (arms.vThickness / 100) * rect.width;

    const inHorizontal = local.x >= 0 && local.x <= hLengthPx && local.y >= 0 && local.y <= hThicknessPx;
    const inVertical = local.x >= 0 && local.x <= vThicknessPx && local.y >= 0 && local.y <= vLengthPx;

    let side = "horizontal";
    if (inHorizontal && !inVertical) {
      side = "horizontal";
    } else if (!inHorizontal && inVertical) {
      side = "vertical";
    } else if (inHorizontal && inVertical) {
      const horizontalProgress = local.x / Math.max(hLengthPx, 1);
      const verticalProgress = local.y / Math.max(vLengthPx, 1);
      side = horizontalProgress >= verticalProgress ? "horizontal" : "vertical";
    } else {
      side = local.x >= local.y ? "horizontal" : "vertical";
    }

    if (side === "horizontal") {
      const nearThicknessEdge = Math.abs(local.y - hThicknessPx) <= EDGE_DETECT_PX;
      const nearLengthEdge = Math.abs(local.x - hLengthPx) <= EDGE_DETECT_PX;

      if (nearThicknessEdge && !nearLengthEdge) {
        return { mode: "thickness", axis: "y", field: "hThickness" };
      }
      if (nearLengthEdge && !nearThicknessEdge) {
        return { mode: "length", axis: "x", field: "hLength" };
      }
      if (nearThicknessEdge && nearLengthEdge) {
        return Math.abs(local.y - hThicknessPx) < Math.abs(local.x - hLengthPx)
          ? { mode: "thickness", axis: "y", field: "hThickness" }
          : { mode: "length", axis: "x", field: "hLength" };
      }
      return { mode: "length", axis: "x", field: "hLength" };
    }

    const nearThicknessEdge = Math.abs(local.x - vThicknessPx) <= EDGE_DETECT_PX;
    const nearLengthEdge = Math.abs(local.y - vLengthPx) <= EDGE_DETECT_PX;

    if (nearThicknessEdge && !nearLengthEdge) {
      return { mode: "thickness", axis: "x", field: "vThickness" };
    }
    if (nearLengthEdge && !nearThicknessEdge) {
      return { mode: "length", axis: "y", field: "vLength" };
    }
    if (nearThicknessEdge && nearLengthEdge) {
      return Math.abs(local.x - vThicknessPx) < Math.abs(local.y - vLengthPx)
        ? { mode: "thickness", axis: "x", field: "vThickness" }
        : { mode: "length", axis: "y", field: "vLength" };
    }
    return { mode: "length", axis: "y", field: "vLength" };
  };

  const handleCornerPointerMove = (corner, event) => {
    if (selectedCorner && selectedCorner !== corner && !dragRef.current) {
      return;
    }

    const intent = getDragIntent(corner, event);
    setHoverState({ corner, mode: intent.mode });
  };

  const startDrag = (corner, event) => {
    if (!onBoxChange || event.button !== 0) {
      return;
    }

    setIsTextEditing(false);
    const isAlreadySelected = selectedCorner === corner;
    // First click only selects the box. Dragging starts only after it's selected.
    setSelectedCorner(corner);
    const intent = getDragIntent(corner, event);
    setHoverState({ corner, mode: intent.mode });

    if (!isAlreadySelected) {
      event.preventDefault();
      return;
    }

    dragRef.current = { corner, mode: intent.mode, axis: intent.axis, field: intent.field };
    event.preventDefault();
  };

  const handleCanvasPointerDown = (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".decorative-arm")) {
      return;
    }
    if (target instanceof Element && target.closest(".text-editor-ui")) {
      return;
    }

    setSelectedCorner(null);
    setHoverState({ corner: null, mode: "size" });
    setIsTextEditing(false);
  };

  const handleTextDisplayPointerDown = (event) => {
    event.stopPropagation();
    setSelectedCorner(null);
    setHoverState({ corner: null, mode: "size" });
    setIsTextEditing(true);
  };

  const stopCanvasPointer = (event) => {
    event.stopPropagation();
  };

  const handleTextInputChange = (event) => {
    if (!onTextChange) {
      return;
    }
    const nextText = limitToThreeLines(event.currentTarget.innerText);
    if (event.currentTarget.innerText !== nextText) {
      event.currentTarget.innerText = nextText;
      placeEditorCaretToEnd(event.currentTarget);
    }
    onTextChange(nextText);
  };

  const insertLineBreakAtCursor = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const breakNode = document.createElement("br");
    range.insertNode(breakNode);

    range.setStartAfter(breakNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  const renderCorner = (key, horizontalClass, verticalClass) => {
    const box = boxes[key];
    if (!box?.enabled) {
      return null;
    }
    const arms = getArmValues(box);
    const isFocused = activeCorner === key;
    const isSelected = selectedCorner === key;
    const intentMode = isSelected && hoverState.corner === key ? hoverState.mode : "size";
    const cursorClass = isSelected
      ? intentMode === "thickness"
        ? "thickness-cursor"
        : "size-cursor"
      : "select-cursor";

    return (
      <>
        <div
          className={`decorative-arm ${horizontalClass} ${isFocused ? "active" : ""} ${cursorClass}`}
          style={{
            ...armStyle(key),
            width: `${arms.hLength}%`,
            height: `${arms.hThickness}%`
          }}
          onPointerDown={(event) => startDrag(key, event)}
          onPointerMove={(event) => handleCornerPointerMove(key, event)}
          onPointerEnter={(event) => handleCornerPointerMove(key, event)}
          onPointerLeave={() =>
            setHoverState((prev) => (prev.corner === key ? { corner: null, mode: "size" } : prev))
          }
        />
        <div
          className={`decorative-arm ${verticalClass} ${isFocused ? "active" : ""} ${cursorClass}`}
          style={{
            ...armStyle(key),
            width: `${arms.vThickness}%`,
            height: `${arms.vLength}%`
          }}
          onPointerDown={(event) => startDrag(key, event)}
          onPointerMove={(event) => handleCornerPointerMove(key, event)}
          onPointerEnter={(event) => handleCornerPointerMove(key, event)}
          onPointerLeave={() =>
            setHoverState((prev) => (prev.corner === key ? { corner: null, mode: "size" } : prev))
          }
        />
      </>
    );
  };

  const textLeft = textLayout.left ?? 0;
  const textTop = textLayout.top ?? 0;
  const textWidth = textLayout.width ?? "100%";
  const textHeight = textLayout.height ?? "100%";
  const toolbarLeft = typeof textLayout.left === "number" && typeof textLayout.width === "number"
    ? textLayout.left + textLayout.width / 2
    : 0;
  const toolbarTop = typeof textLayout.top === "number" ? Math.max(8, textLayout.top - 76) : 8;
  const textStyle = {
    color: textColor,
    fontSize,
    fontWeight,
    fontFamily,
    left: textLeft,
    top: textTop,
    width: textWidth,
    height: textHeight
  };

  return (
    <section className="canvas-shell">
      <div className="canvas-frame">
        <div
          ref={canvasRef}
          className="banner-canvas"
          style={{ ...canvasStyle, ...sizingStyle, aspectRatio }}
          onPointerDown={handleCanvasPointerDown}
        >
          {backgroundImage && (
            <img
              className="canvas-bg-image"
              src={backgroundImage}
              alt=""
              style={{
                transform: `translate(${backgroundImageOffsetX}%, ${backgroundImageOffsetY}%) scale(${backgroundImageScale / 100})`
              }}
              draggable={false}
            />
          )}
          {renderCorner("topLeft", "top-left-h", "top-left-v")}
          {renderCorner("topRight", "top-right-h", "top-right-v")}
          {renderCorner("bottomLeft", "bottom-left-h", "bottom-left-v")}
          {renderCorner("bottomRight", "bottom-right-h", "bottom-right-v")}

          <div className="text-editor-ui">
            {isTextEditing && (
              <div
                className="text-toolbar"
                style={{ left: toolbarLeft, top: toolbarTop }}
                onPointerDown={stopCanvasPointer}
              >
                <label className="toolbar-item toolbar-color">
                  <span>Color</span>
                  <ColorControl
                    value={textColor}
                    onChange={onTextColorChange}
                    className="toolbar-color-control"
                    hexLabel="Text color HEX"
                    idPrefix="text-color"
                  />
                </label>
                <label className="toolbar-item">
                  <span>Size</span>
                  <input
                    type="range"
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    value={fontSize}
                    onChange={(event) => onFontSizeChange?.(Number(event.target.value))}
                  />
                </label>
                <label className="toolbar-item">
                  <span>Weight</span>
                  <input
                    type="range"
                    min={MIN_FONT_WEIGHT}
                    max={MAX_FONT_WEIGHT}
                    step="100"
                    value={fontWeight}
                    onChange={(event) => onFontWeightChange?.(Number(event.target.value))}
                  />
                </label>
                <label className="toolbar-item">
                  <span>Font</span>
                  <select
                    value={fontFamily}
                    onChange={(event) => onFontFamilyChange?.(event.target.value)}
                  >
                    {FONT_FAMILY_OPTIONS.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {isTextEditing ? (
              <div
                ref={textEditorRef}
                className="center-text center-text-editor"
                style={textStyle}
                contentEditable
                suppressContentEditableWarning
                onPointerDown={stopCanvasPointer}
                onInput={handleTextInputChange}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsTextEditing(false);
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    const currentLineCount = event.currentTarget.innerText.split(/\r?\n/).length;
                    if (currentLineCount >= 3) {
                      return;
                    }
                    const inserted = insertLineBreakAtCursor();
                    if (inserted) {
                      onTextChange?.(limitToThreeLines(event.currentTarget.innerText));
                    }
                  }
                }}
              />
            ) : (
              <p className="center-text center-text-display" style={textStyle} onPointerDown={handleTextDisplayPointerDown}>
                {textValue}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default BannerCanvas;
