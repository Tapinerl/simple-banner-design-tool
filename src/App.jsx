import { useEffect, useState } from "react";
import { toBlob, toJpeg, toPng, toSvg } from "html-to-image";
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

const BOX_IDS = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
const MIN_ARM_SIZE = 20;
const MAX_ARM_SIZE = 200;
const MIN_ARM_THICKNESS = 2;
const MAX_ARM_THICKNESS = 200;
const EXPORT_CANVAS_ID = "banner-export-canvas";
const EXPORT_PIXEL_RATIO = 2;
const GOOGLE_FONTS_API_ENDPOINT = "/.netlify/functions/google-fonts";
const GOOGLE_FONT_LIMIT = 40;

const LOCAL_FONT_OPTIONS = [
  { label: "Trebuchet", value: '"Trebuchet MS", "Segoe UI", sans-serif', source: "local" },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif', source: "local" },
  { label: "Verdana", value: 'Verdana, Geneva, sans-serif', source: "local" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif", source: "local" },
  { label: "Courier", value: '"Courier New", Courier, monospace', source: "local" }
];

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const downloadDataUrl = (dataUrl, filename) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
};
const fallbackByCategory = (category) => {
  if (category === "serif") {
    return "serif";
  }
  if (category === "monospace") {
    return "monospace";
  }
  return "sans-serif";
};
const toGoogleFontValue = (family, category) => `"${family}", ${fallbackByCategory(category)}`;

const normalizeBoxGeometry = (box) => {
  const normalized = {
    ...box,
    hLength: clamp(box?.hLength ?? box?.size ?? 50, MIN_ARM_SIZE, MAX_ARM_SIZE),
    vLength: clamp(box?.vLength ?? box?.size ?? 50, MIN_ARM_SIZE, MAX_ARM_SIZE),
    hThickness: clamp(box?.hThickness ?? box?.thickness ?? 10, MIN_ARM_THICKNESS, MAX_ARM_THICKNESS),
    vThickness: clamp(box?.vThickness ?? box?.thickness ?? 10, MIN_ARM_THICKNESS, MAX_ARM_THICKNESS)
  };

  // Prevent one arm from clipping inside the other arm.
  normalized.hLength = Math.max(normalized.hLength, normalized.vThickness);
  normalized.vLength = Math.max(normalized.vLength, normalized.hThickness);
  normalized.hThickness = Math.min(normalized.hThickness, normalized.vLength);
  normalized.vThickness = Math.min(normalized.vThickness, normalized.hLength);

  return normalized;
};

const normalizeBoxesState = (boxState) => {
  const next = { ...boxState };
  BOX_IDS.forEach((boxId) => {
    next[boxId] = normalizeBoxGeometry(next[boxId]);
  });
  return next;
};

const DEFAULT_BOXES = {
  topLeft: { size: 50, thickness: 10, hLength: 50, vLength: 50, hThickness: 10, vThickness: 10, enabled: false },
  topRight: { size: 50, thickness: 10, hLength: 50, vLength: 50, hThickness: 10, vThickness: 10, enabled: true },
  bottomLeft: { size: 50, thickness: 10, hLength: 50, vLength: 50, hThickness: 10, vThickness: 10, enabled: true },
  bottomRight: { size: 50, thickness: 10, hLength: 50, vLength: 50, hThickness: 10, vThickness: 10, enabled: false }
};

const syncLinkedPairs = (boxState) => normalizeBoxesState({
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
  const [fontFamily, setFontFamily] = useState(LOCAL_FONT_OPTIONS[0].value);
  const [fontOptions, setFontOptions] = useState(LOCAL_FONT_OPTIONS);
  const [cornerRadius, setCornerRadius] = useState(5);
  const [boxColor, setBoxColor] = useState("#d1d5db");
  const [linkedMovement, setLinkedMovement] = useState(true);
  const [activeDiagonal, setActiveDiagonal] = useState("tr-bl");
  const [boxes, setBoxes] = useState(() => normalizeBoxesState(DEFAULT_BOXES));
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

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
    setCenterText(value);
  };

  const handleLinkedMovementChange = (nextValue) => {
    setLinkedMovement(nextValue);

    if (nextValue) {
      setBoxes((prev) => syncLinkedPairs(prev));
    }
  };

  const handleBoxChange = (boxId, field, value) => {
    setBoxes((prev) => {
      const nextBox = normalizeBoxGeometry({
        ...prev[boxId],
        [field]: value
      });

      const nextState = {
        ...prev,
        [boxId]: nextBox
      };

      if (!linkedMovement) {
        return normalizeBoxesState(nextState);
      }

      const oppositeId = OPPOSITE_BOX[boxId];
      return normalizeBoxesState({
        ...nextState,
        [oppositeId]: normalizeBoxGeometry({
          ...nextState[oppositeId],
          [field]: nextBox[field]
        })
      });
    });
  };

  const handleActiveDiagonalChange = (nextDiagonal) => {
    if (nextDiagonal === activeDiagonal) {
      return;
    }

    setBoxes((prev) => {
      if (activeDiagonal === "tr-bl" && nextDiagonal === "tl-br") {
        return normalizeBoxesState({
          ...prev,
          topLeft: { ...prev.topRight, enabled: true },
          bottomRight: { ...prev.bottomLeft, enabled: true },
          topRight: { ...prev.topRight, enabled: false },
          bottomLeft: { ...prev.bottomLeft, enabled: false }
        });
      }

      return normalizeBoxesState({
        ...prev,
        topRight: { ...prev.topLeft, enabled: true },
        bottomLeft: { ...prev.bottomRight, enabled: true },
        topLeft: { ...prev.topLeft, enabled: false },
        bottomRight: { ...prev.bottomRight, enabled: false }
      });
    });

    setActiveDiagonal(nextDiagonal);
  };

  const handleFlipBoxes = () => {
    handleActiveDiagonalChange(activeDiagonal === "tr-bl" ? "tl-br" : "tr-bl");
  };

  useEffect(() => {
    let isMounted = true;

    const loadGoogleFonts = async () => {
      try {
        const response = await fetch(`${GOOGLE_FONTS_API_ENDPOINT}?limit=${GOOGLE_FONT_LIMIT}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const googleOptions = (payload.items ?? []).map((font) => ({
          label: font.family,
          value: toGoogleFontValue(font.family, font.category),
          source: "google",
          family: font.family
        }));

        if (!isMounted || googleOptions.length === 0) {
          return;
        }

        setFontOptions([...LOCAL_FONT_OPTIONS, ...googleOptions]);
      } catch (error) {
        // Keep local fonts as fallback if API request fails.
      }
    };

    loadGoogleFonts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const selectedOption = fontOptions.find((option) => option.value === fontFamily);
    if (!selectedOption || selectedOption.source !== "google" || !selectedOption.family) {
      return;
    }

    const styleId = `google-font-${selectedOption.family.replace(/\s+/g, "-").toLowerCase()}`;
    if (document.getElementById(styleId)) {
      return;
    }

    const stylesheet = document.createElement("link");
    stylesheet.id = styleId;
    stylesheet.rel = "stylesheet";
    stylesheet.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      selectedOption.family
    ).replace(/%20/g, "+")}:wght@400;700&display=swap`;
    document.head.appendChild(stylesheet);

    if (document.fonts?.load) {
      document.fonts.load(`1em "${selectedOption.family}"`).catch(() => {
        // Keep rendering with fallback fonts if this load fails.
      });
    }
  }, [fontFamily, fontOptions]);

  const runExport = async (task, successMessage) => {
    if (isExporting) {
      return;
    }

    const canvasNode = document.getElementById(EXPORT_CANVAS_ID);
    if (!canvasNode) {
      setExportMessage("Export failed: canvas was not found.");
      return;
    }

    try {
      setIsExporting(true);
      setExportMessage("");
      await task(canvasNode);
      setExportMessage(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected export error.";
      setExportMessage(`Export failed: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportFileName = (extension) => `banner-${selectedRatio.replace(":", "x")}.${extension}`;
  const exportOptions = {
    pixelRatio: EXPORT_PIXEL_RATIO,
    cacheBust: true,
    filter: (node) => {
      if (!(node instanceof Element)) {
        return true;
      }
      if (node.classList.contains("arm-handle")) {
        return false;
      }
      if (node.classList.contains("text-toolbar")) {
        return false;
      }
      return true;
    }
  };

  const handleExportPng = () =>
    runExport(async (canvasNode) => {
      const dataUrl = await toPng(canvasNode, exportOptions);
      downloadDataUrl(dataUrl, exportFileName("png"));
    }, "PNG exported.");

  const handleExportJpg = () =>
    runExport(async (canvasNode) => {
      const dataUrl = await toJpeg(canvasNode, {
        ...exportOptions,
        quality: 0.95,
      });
      downloadDataUrl(dataUrl, exportFileName("jpg"));
    }, "JPG exported.");

  const handleExportSvg = () =>
    runExport(async (canvasNode) => {
      const dataUrl = await toSvg(canvasNode, exportOptions);
      downloadDataUrl(dataUrl, exportFileName("svg"));
    }, "SVG exported.");

  const handleCopyToClipboard = () =>
    runExport(async (canvasNode) => {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard copy is not supported in this browser.");
      }

      const blob = await toBlob(canvasNode, exportOptions);
      if (!blob) {
        throw new Error("Could not generate image blob.");
      }

      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    }, "Copied PNG to clipboard.");

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
        onExportPng={handleExportPng}
        onExportJpg={handleExportJpg}
        onExportSvg={handleExportSvg}
        onCopyToClipboard={handleCopyToClipboard}
        isExporting={isExporting}
        exportMessage={exportMessage}
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
          fontOptions={fontOptions}
          onFontFamilyChange={setFontFamily}
          boxes={boxes}
          onBoxChange={handleBoxChange}
          boxColor={boxColor}
          cornerRadius={cornerRadius}
          canvasId={EXPORT_CANVAS_ID}
        />
      </main>
    </div>
  );
}

export default App;
