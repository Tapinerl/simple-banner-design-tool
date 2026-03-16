import { useState } from "react";
import BannerCanvas from "./components/BannerCanvas";
import ControlsPanel from "./components/ControlsPanel";
import "./styles/app.css";

const RATIO_OPTIONS = [
  { id: "16:9", label: "16:9", value: "16 / 9" },
  { id: "9:16", label: "9:16", value: "9 / 16" },
  { id: "4:5", label: "4:5", value: "4 / 5" }
];

const OPPOSITE_BOX = {
  topLeft: "bottomRight",
  bottomRight: "topLeft",
  topRight: "bottomLeft",
  bottomLeft: "topRight"
};

const DEFAULT_BOXES = {
  topLeft: { size: 50, thickness: 10, hLength: 50, vLength: 50, hThickness: 10, vThickness: 10, enabled: false },
  topRight: { size: 50, thickness: 10, hLength: 50, vLength: 50, hThickness: 10, vThickness: 10, enabled: true },
  bottomLeft: { size: 50, thickness: 10, hLength: 50, vLength: 50, hThickness: 10, vThickness: 10, enabled: true },
  bottomRight: { size: 50, thickness: 10, hLength: 50, vLength: 50, hThickness: 10, vThickness: 10, enabled: false }
};

const limitToThreeLines = (value) => value.split(/\r?\n/).slice(0, 3).join("\n");

const syncLinkedPairs = (boxState) => ({
  ...boxState,
  bottomRight: {
    ...boxState.topLeft,
    enabled: boxState.topLeft.enabled
  },
  bottomLeft: {
    ...boxState.topRight,
    enabled: boxState.topRight.enabled
  }
});

function App() {
  const [selectedRatio, setSelectedRatio] = useState("16:9");
  const [backgroundColor, setBackgroundColor] = useState("#9ca3af");
  const [backgroundImage, setBackgroundImage] = useState("");
  const [backgroundImageScale, setBackgroundImageScale] = useState(100);
  const [backgroundImageOffsetX, setBackgroundImageOffsetX] = useState(0);
  const [backgroundImageOffsetY, setBackgroundImageOffsetY] = useState(0);
  const [centerText, setCenterText] = useState("TEXT IN THE MIDDLE");
  const [textColor, setTextColor] = useState("#111827");
  const [fontSize, setFontSize] = useState(48);
  const [fontWeight, setFontWeight] = useState(700);
  const [fontFamily, setFontFamily] = useState('"Trebuchet MS", "Segoe UI", sans-serif');
  const [cornerRadius, setCornerRadius] = useState(28);
  const [boxColor, setBoxColor] = useState("#d1d5db");
  const [linkedMovement, setLinkedMovement] = useState(true);
  const [activeDiagonal, setActiveDiagonal] = useState("tr-bl");
  const [boxes, setBoxes] = useState(DEFAULT_BOXES);

  const handleBackgroundImageUpload = (file) => {
    if (!file) {
      return;
    }

    const fileReader = new FileReader();
    fileReader.onload = () => {
      if (typeof fileReader.result === "string") {
        setBackgroundImage(fileReader.result);
        setBackgroundImageScale(100);
        setBackgroundImageOffsetX(0);
        setBackgroundImageOffsetY(0);
      }
    };
    fileReader.readAsDataURL(file);
  };

  const handleClearBackgroundImage = () => {
    setBackgroundImage("");
    setBackgroundImageScale(100);
    setBackgroundImageOffsetX(0);
    setBackgroundImageOffsetY(0);
  };

  const handleTextChange = (value) => {
    setCenterText(limitToThreeLines(value));
  };

  const handleLinkedMovementChange = (nextValue) => {
    setLinkedMovement(nextValue);

    if (nextValue) {
      setBoxes((prev) => syncLinkedPairs(prev));
    }
  };

  const handleBoxChange = (boxId, field, value) => {
    setBoxes((prev) => {
      const nextState = {
        ...prev,
        [boxId]: {
          ...prev[boxId],
          [field]: value
        }
      };

      if (!linkedMovement) {
        return nextState;
      }

      const oppositeId = OPPOSITE_BOX[boxId];
      return {
        ...nextState,
        [oppositeId]: {
          ...nextState[oppositeId],
          [field]: value
        }
      };
    });
  };

  const handleActiveDiagonalChange = (nextDiagonal) => {
    if (nextDiagonal === activeDiagonal) {
      return;
    }

    setBoxes((prev) => {
      if (activeDiagonal === "tr-bl" && nextDiagonal === "tl-br") {
        return {
          ...prev,
          topLeft: { ...prev.topRight, enabled: true },
          bottomRight: { ...prev.bottomLeft, enabled: true },
          topRight: { ...prev.topRight, enabled: false },
          bottomLeft: { ...prev.bottomLeft, enabled: false }
        };
      }

      return {
        ...prev,
        topRight: { ...prev.topLeft, enabled: true },
        bottomLeft: { ...prev.bottomRight, enabled: true },
        topLeft: { ...prev.topLeft, enabled: false },
        bottomRight: { ...prev.bottomRight, enabled: false }
      };
    });

    setActiveDiagonal(nextDiagonal);
  };

  const handleFlipBoxes = () => {
    handleActiveDiagonalChange(activeDiagonal === "tr-bl" ? "tl-br" : "tr-bl");
  };

  return (
    <div className="app-shell">
      <ControlsPanel
        ratios={RATIO_OPTIONS}
        selectedRatio={selectedRatio}
        onRatioChange={setSelectedRatio}
        backgroundColor={backgroundColor}
        onBackgroundColorChange={setBackgroundColor}
        onBackgroundImageUpload={handleBackgroundImageUpload}
        onClearBackgroundImage={handleClearBackgroundImage}
        hasBackgroundImage={Boolean(backgroundImage)}
        backgroundImageScale={backgroundImageScale}
        onBackgroundImageScaleChange={setBackgroundImageScale}
        backgroundImageOffsetX={backgroundImageOffsetX}
        onBackgroundImageOffsetXChange={setBackgroundImageOffsetX}
        backgroundImageOffsetY={backgroundImageOffsetY}
        onBackgroundImageOffsetYChange={setBackgroundImageOffsetY}
        cornerRadius={cornerRadius}
        onCornerRadiusChange={setCornerRadius}
        boxColor={boxColor}
        onBoxColorChange={setBoxColor}
        linkedMovement={linkedMovement}
        onLinkedMovementChange={handleLinkedMovementChange}
        activeDiagonal={activeDiagonal}
        onFlipBoxes={handleFlipBoxes}
      />

      <main className="preview-area">
        <BannerCanvas
          aspectRatio={RATIO_OPTIONS.find((ratio) => ratio.id === selectedRatio)?.value ?? "16 / 9"}
          backgroundColor={backgroundColor}
          backgroundImage={backgroundImage}
          backgroundImageScale={backgroundImageScale}
          backgroundImageOffsetX={backgroundImageOffsetX}
          backgroundImageOffsetY={backgroundImageOffsetY}
          textValue={centerText}
          onTextChange={handleTextChange}
          textColor={textColor}
          onTextColorChange={setTextColor}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          fontWeight={fontWeight}
          onFontWeightChange={setFontWeight}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          boxes={boxes}
          onBoxChange={handleBoxChange}
          boxColor={boxColor}
          cornerRadius={cornerRadius}
        />
      </main>
    </div>
  );
}

export default App;
