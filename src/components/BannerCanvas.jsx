import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ColorControl from "./ColorControl";

const TEXT_PADDING = 24;
const MIN_ARM_SIZE = 20;
const MAX_ARM_SIZE = 200;
const MIN_ARM_THICKNESS = 2;
const MAX_ARM_THICKNESS = 200;
const SNAP_THRESHOLD = 2;
const MIN_FONT_SIZE = 18;
const MAX_FONT_SIZE = 110;
const MIN_FONT_WEIGHT = 100;
const MAX_FONT_WEIGHT = 900;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const snapToBoundary = (value, min, max) => {
  if (Math.abs(value - min) <= SNAP_THRESHOLD) {
    return min;
  }
  if (Math.abs(max - value) <= SNAP_THRESHOLD) {
    return max;
  }
  return value;
};
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

const toCanvasPercent = (corner, localX, localY) => {
  if (corner === "topLeft") {
    return { x: localX, y: localY };
  }
  if (corner === "topRight") {
    return { x: 100 - localX, y: localY };
  }
  if (corner === "bottomLeft") {
    return { x: localX, y: 100 - localY };
  }
  return { x: 100 - localX, y: 100 - localY };
};

const getHandlePositions = (corner, arms, toCanvasXPercent, toCanvasYPercent) => {
  const local = {
    corner: { x: arms.vThickness, y: arms.hThickness },
    hLength: { x: arms.hLength, y: arms.hThickness / 2 },
    vLength: { x: arms.vThickness / 2, y: arms.vLength },
    hThickness: { x: (arms.hLength + arms.vThickness) / 2, y: arms.hThickness },
    vThickness: { x: arms.vThickness, y: (arms.vLength + arms.hThickness) / 2 }
  };

  return Object.fromEntries(
    Object.entries(local).map(([key, value]) => [
      key,
      toCanvasPercent(corner, toCanvasXPercent(value.x), toCanvasYPercent(value.y))
    ])
  );
};

const getOpposingCenterRegion = (boxes, width, height) => {
  const minDimension = Math.max(1, Math.min(width, height));
  const unitToPixels = (value) => (value / 100) * minDimension;
  const hasTrBl = boxes.topRight?.enabled && boxes.bottomLeft?.enabled;
  const hasTlBr = boxes.topLeft?.enabled && boxes.bottomRight?.enabled;

  if (hasTrBl) {
    const tr = getArmValues(boxes.topRight);
    const bl = getArmValues(boxes.bottomLeft);
    const trPoint = {
      // Concave inner corner of top-right L
      x: width - unitToPixels(tr.vThickness),
      y: unitToPixels(tr.hThickness)
    };
    const blPoint = {
      // Concave inner corner of bottom-left L
      x: unitToPixels(bl.vThickness),
      y: height - unitToPixels(bl.hThickness)
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
      x: unitToPixels(tl.vThickness),
      y: unitToPixels(tl.hThickness)
    };
    const brPoint = {
      // Concave inner corner of bottom-right L
      x: width - unitToPixels(br.vThickness),
      y: height - unitToPixels(br.hThickness)
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
  fontOptions = [],
  onFontFamilyChange,
  boxes,
  onBoxChange,
  boxColor,
  cornerRadius,
  canvasId = "banner-export-canvas"
}) {
  const canvasRef = useRef(null);
  const textEditorRef = useRef(null);
  const dragRef = useRef(null);
  const [selectedCorner, setSelectedCorner] = useState(null);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const activeCorner = selectedCorner;

  const [textLayout, setTextLayout] = useState({
    left: null,
    top: null,
    width: null,
    height: null
  });
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });

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

  const minCanvasDimension = Math.max(1, Math.min(canvasSize.width, canvasSize.height));
  const toCanvasXPercent = useCallback(
    (value) => (value / 100) * (minCanvasDimension / Math.max(1, canvasSize.width)) * 100,
    [canvasSize.width, minCanvasDimension]
  );
  const toCanvasYPercent = useCallback(
    (value) => (value / 100) * (minCanvasDimension / Math.max(1, canvasSize.height)) * 100,
    [canvasSize.height, minCanvasDimension]
  );

  const updateTextSizing = useCallback(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) {
      return;
    }

    const { width: canvasWidth, height: canvasHeight } = canvasNode.getBoundingClientRect();
    setCanvasSize((prev) => {
      if (
        Math.abs(prev.width - canvasWidth) < 0.5 &&
        Math.abs(prev.height - canvasHeight) < 0.5
      ) {
        return prev;
      }
      return { width: canvasWidth, height: canvasHeight };
    });
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

      const { corner, field } = dragRef.current;
      const box = boxes[corner];
      if (!box?.enabled) {
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const local = getLocalFromCorner(corner, event.clientX, event.clientY, rect);
      const minDimension = Math.max(1, Math.min(rect.width, rect.height));

      const nextLengthX = snapToBoundary(
        clamp(Math.round((local.x / minDimension) * 100), MIN_ARM_SIZE, MAX_ARM_SIZE),
        MIN_ARM_SIZE,
        MAX_ARM_SIZE
      );
      const nextLengthY = snapToBoundary(
        clamp(Math.round((local.y / minDimension) * 100), MIN_ARM_SIZE, MAX_ARM_SIZE),
        MIN_ARM_SIZE,
        MAX_ARM_SIZE
      );
      const nextThicknessX = snapToBoundary(
        clamp(Math.round((local.x / minDimension) * 100), MIN_ARM_THICKNESS, MAX_ARM_THICKNESS),
        MIN_ARM_THICKNESS,
        MAX_ARM_THICKNESS
      );
      const nextThicknessY = snapToBoundary(
        clamp(Math.round((local.y / minDimension) * 100), MIN_ARM_THICKNESS, MAX_ARM_THICKNESS),
        MIN_ARM_THICKNESS,
        MAX_ARM_THICKNESS
      );

      if (field === "corner") {
        if (box.hLength !== nextLengthX) {
          onBoxChange(corner, "hLength", nextLengthX);
        }
        if (box.vLength !== nextLengthY) {
          onBoxChange(corner, "vLength", nextLengthY);
        }
        return;
      }

      const valueByField = {
        hLength: nextLengthX,
        vLength: nextLengthY,
        hThickness: nextThicknessY,
        vThickness: nextThicknessX
      };
      const nextValue = valueByField[field];
      if (typeof nextValue === "number" && box[field] !== nextValue) {
        onBoxChange(corner, field, nextValue);
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
        setIsTextEditing(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const startDrag = (corner, field, event) => {
    if (!onBoxChange || event.button !== 0) {
      return;
    }

    setIsTextEditing(false);
    setSelectedCorner(corner);
    dragRef.current = { corner, field };
    event.stopPropagation();
    event.preventDefault();
  };

  const handleCanvasPointerDown = (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".l-box-interactive")) {
      return;
    }
    if (target instanceof Element && target.closest(".text-editor-ui")) {
      return;
    }

    setSelectedCorner(null);
    setIsTextEditing(false);
  };

  const handleTextDisplayPointerDown = (event) => {
    event.stopPropagation();
    setSelectedCorner(null);
    setIsTextEditing(true);
  };

  const stopCanvasPointer = (event) => {
    event.stopPropagation();
  };

  const handleTextInputChange = (event) => {
    if (!onTextChange) {
      return;
    }
    onTextChange(event.currentTarget.innerText);
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

  const renderResizeHandle = (corner, field, position, className, label) => (
    <button
      key={`${corner}-${field}`}
      type="button"
      className={`arm-handle l-box-interactive ${className}`}
      style={{
        left: `${clamp(position.x, 0, 100)}%`,
        top: `${clamp(position.y, 0, 100)}%`
      }}
      aria-label={label}
      onPointerDown={(event) => startDrag(corner, field, event)}
    />
  );

  const renderCorner = (key, horizontalClass, verticalClass) => {
    const box = boxes[key];
    if (!box?.enabled) {
      return null;
    }
    const arms = getArmValues(box);
    const isFocused = activeCorner === key;
    const isSelected = selectedCorner === key;
    const handlePositions = getHandlePositions(key, arms, toCanvasXPercent, toCanvasYPercent);

    return (
      <>
        <div
          className={`decorative-arm l-box-interactive ${horizontalClass} ${
            isFocused ? "active" : ""
          } drag-corner-cursor`}
          style={{
            ...armStyle(key),
            width: `${toCanvasXPercent(arms.hLength)}%`,
            height: `${toCanvasYPercent(arms.hThickness)}%`
          }}
          onPointerDown={(event) => startDrag(key, "corner", event)}
        />
        <div
          className={`decorative-arm l-box-interactive ${verticalClass} ${
            isFocused ? "active" : ""
          } drag-corner-cursor`}
          style={{
            ...armStyle(key),
            width: `${toCanvasXPercent(arms.vThickness)}%`,
            height: `${toCanvasYPercent(arms.vLength)}%`
          }}
          onPointerDown={(event) => startDrag(key, "corner", event)}
        />
        {isSelected && (
          <>
            {renderResizeHandle(key, "corner", handlePositions.corner, "handle-corner", "Drag corner block")}
            {renderResizeHandle(
              key,
              "hLength",
              handlePositions.hLength,
              "handle-length-x",
              "Resize horizontal arm length"
            )}
            {renderResizeHandle(
              key,
              "vLength",
              handlePositions.vLength,
              "handle-length-y",
              "Resize vertical arm length"
            )}
            {renderResizeHandle(
              key,
              "hThickness",
              handlePositions.hThickness,
              "handle-thickness-y",
              "Resize horizontal arm thickness"
            )}
            {renderResizeHandle(
              key,
              "vThickness",
              handlePositions.vThickness,
              "handle-thickness-x",
              "Resize vertical arm thickness"
            )}
          </>
        )}
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
    <section className={`canvas-shell ${isTextEditing ? "is-text-editing" : ""}`}>
      <div className={`canvas-frame ${isTextEditing ? "is-text-editing" : ""}`}>
        <div
          ref={canvasRef}
          id={canvasId}
          className={`banner-canvas ${isTextEditing ? "is-text-editing" : ""}`}
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
                    {fontOptions.map((option) => (
                      <option key={`${option.label}-${option.value}`} value={option.value}>
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
                    const inserted = insertLineBreakAtCursor();
                    if (inserted) {
                      onTextChange?.(event.currentTarget.innerText);
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
