import ColorControl from "./ColorControl";

function ControlsPanel({
  ratios,
  selectedRatio,
  onRatioChange,
  backgroundColor,
  onBackgroundColorChange,
  onBackgroundImageUpload,
  onClearBackgroundImage,
  hasBackgroundImage,
  backgroundImageScale,
  onBackgroundImageScaleChange,
  backgroundImageOffsetX,
  onBackgroundImageOffsetXChange,
  backgroundImageOffsetY,
  onBackgroundImageOffsetYChange,
  cornerRadius,
  onCornerRadiusChange,
  boxColor,
  onBoxColorChange,
  linkedMovement,
  onLinkedMovementChange,
  activeDiagonal,
  onFlipBoxes
}) {
  const activePairLabel =
    activeDiagonal === "tr-bl" ? "Top Right + Bottom Left" : "Top Left + Bottom Right";

  return (
    <aside className="controls-panel">
      <div className="panel-title">
        <h2>Controls</h2>
        <p>Drag arm handles and click center text on the canvas to edit it.</p>
      </div>

      <section className="panel-section">
        <h3>Background</h3>
        <label>
          Background Color
          <ColorControl
            value={backgroundColor}
            onChange={onBackgroundColorChange}
            hexLabel="Background color HEX"
            idPrefix="background-color"
          />
        </label>

        <label>
          Background Image
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onBackgroundImageUpload(event.target.files?.[0])}
          />
        </label>

        {hasBackgroundImage && (
          <>
            <label>
              Image Scale
              <input
                type="range"
                min="50"
                max="200"
                value={backgroundImageScale}
                onChange={(event) => onBackgroundImageScaleChange(Number(event.target.value))}
              />
              <span>{backgroundImageScale}%</span>
            </label>
            <label>
              Image Horizontal
              <input
                type="range"
                min="-50"
                max="50"
                value={backgroundImageOffsetX}
                onChange={(event) => onBackgroundImageOffsetXChange(Number(event.target.value))}
              />
              <span>{backgroundImageOffsetX}%</span>
            </label>
            <label>
              Image Vertical
              <input
                type="range"
                min="-50"
                max="50"
                value={backgroundImageOffsetY}
                onChange={(event) => onBackgroundImageOffsetYChange(Number(event.target.value))}
              />
              <span>{backgroundImageOffsetY}%</span>
            </label>
            <button type="button" className="clear-image-button" onClick={onClearBackgroundImage}>
              Remove Uploaded Image
            </button>
          </>
        )}
      </section>

      <section className="panel-section">
        <h3>Canvas Ratio</h3>
        <div className="ratio-list">
          {ratios.map((ratio) => (
            <label key={ratio.id} className="radio-row">
              <input
                type="radio"
                name="canvas-ratio"
                checked={selectedRatio === ratio.id}
                onChange={() => onRatioChange(ratio.id)}
              />
              {ratio.label}
            </label>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Decorative Boxes</h3>
        <p className="control-hint">Active Pair: {activePairLabel}</p>
        <label>
          Color
          <ColorControl
            value={boxColor}
            onChange={onBoxColorChange}
            hexLabel="Decorative box color HEX"
            idPrefix="box-color"
          />
        </label>
        <label>
          Corner Radius
          <input
            type="range"
            min="0"
            max="120"
            value={cornerRadius}
            onChange={(event) => onCornerRadiusChange(Number(event.target.value))}
          />
          <span>{cornerRadius}px</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={linkedMovement}
            onChange={(event) => onLinkedMovementChange(event.target.checked)}
          />
          Linked movement
        </label>
        <button type="button" className="clear-image-button" onClick={onFlipBoxes}>
          Flip Boxes
        </button>
      </section>
    </aside>
  );
}

export default ControlsPanel;
