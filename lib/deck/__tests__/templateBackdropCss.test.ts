import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { gradientCss, pptxBackdropCss, slideBackdropCss } from "@/lib/deck/render/templateBackdropCss";

const W = 12192000;
const H = 6858000;

const radial = (focus: string) =>
  `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="262E3E"/></a:gs><a:gs pos="45000"><a:srgbClr val="181B21"/></a:gs><a:gs pos="100000"><a:srgbClr val="111317"/></a:gs></a:gsLst><a:path path="circle">${focus}</a:path></a:gradFill>`;

const shape = (fill: string, text = "", x = 0, y = 0, w = W, h = H) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"/>${fill}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;

const slide = (bg: string, ...shapes: string[]) =>
  `<p:sld><p:cSld><p:bg><p:bgPr>${bg}</p:bgPr></p:bg><p:spTree><p:nvGrpSpPr/><p:grpSpPr/>${shapes.join("")}</p:spTree></p:cSld></p:sld>`;

describe("gradientCss", () => {
  it("turns a radial gradient lit from the top left into CSS", () => {
    expect(gradientCss(radial(`<a:fillToRect b="100%" l="0%" r="100%" t="0%"/>`))).toBe(
      "radial-gradient(circle farthest-corner at 0% 0%, #262E3E 0%, #181B21 45%, #111317 100%)",
    );
  });

  it("puts the focus in the bottom right when the insets say so", () => {
    expect(gradientCss(radial(`<a:fillToRect b="0%" l="100%" r="0%" t="100%"/>`))).toMatch(/at 100% 100%/);
  });

  it("converts a linear angle and alpha", () => {
    const g = `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FF0000"><a:alpha val="50000"/></a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>`;
    expect(gradientCss(g)).toBe("linear-gradient(180deg, rgba(255, 0, 0, 0.500) 0%, #0000FF 100%)");
  });

  it("gives up on colors it can't read", () => {
    const g = `<a:gradFill><a:gsLst><a:gs pos="0"><a:schemeClr val="accent1"/></a:gs><a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs></a:gsLst><a:lin ang="0"/></a:gradFill>`;
    expect(gradientCss(g)).toBeUndefined();
  });
});

describe("slideBackdropCss", () => {
  const solidBg = `<a:solidFill><a:srgbClr val="262E3E"/></a:solidFill>`;

  it("uses a full-slide, text-free gradient shape and the slide's own color", () => {
    const css = slideBackdropCss(slide(solidBg, shape(radial(`<a:fillToRect l="0%" t="0%" r="100%" b="100%"/>`))), W, H);
    expect(css?.image).toMatch(/^radial-gradient/);
    expect(css?.color).toBe("#262E3E");
  });

  it("ignores shapes with text and shapes that don't cover the slide", () => {
    const xml = slide(
      solidBg,
      shape(radial(`<a:fillToRect l="0%" t="0%" r="100%" b="100%"/>`), "Title"),
      shape(radial(`<a:fillToRect l="0%" t="0%" r="100%" b="100%"/>`), "", 0, 0, W / 2, H),
    );
    expect(slideBackdropCss(xml, W, H)).toBeUndefined();
  });
});

describe("pptxBackdropCss", () => {
  it("finds slides in presentation order", async () => {
    const zip = new JSZip();
    zip.file("ppt/presentation.xml", `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId9"/><p:sldId id="257" r:id="rId8"/></p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/></p:presentation>`);
    zip.file("ppt/_rels/presentation.xml.rels", `<Relationships><Relationship Id="rId8" Target="slides/slide1.xml"/><Relationship Id="rId9" Target="slides/slide2.xml"/></Relationships>`);
    zip.file("ppt/slides/slide1.xml", slide("", shape(radial(`<a:fillToRect l="0%" t="0%" r="100%" b="100%"/>`))));
    zip.file("ppt/slides/slide2.xml", slide("", shape(radial(`<a:fillToRect l="100%" t="100%" r="0%" b="0%"/>`))));
    const found = await pptxBackdropCss(await zip.generateAsync({ type: "uint8array" }), [{ index: 0 }, { index: 1 }]);
    expect(found[0]?.image).toMatch(/at 100% 100%/); // slide2.xml comes first
    expect(found[1]?.image).toMatch(/at 0% 0%/);
  });
});

describe("pptxBackdropCss pictures", () => {
  it("returns only the pictures the backdrop keeps, as data URLs", async () => {
    const pic = (rid: string, x: number) =>
      `<p:pic><p:nvPicPr><p:cNvPr id="3" name="p"/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="0"/><a:ext cx="${W / 4}" cy="${H / 4}"/></a:xfrm></p:spPr></p:pic>`;
    const zip = new JSZip();
    zip.file("ppt/presentation.xml", `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/></p:presentation>`);
    zip.file("ppt/_rels/presentation.xml.rels", `<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>`);
    zip.file("ppt/slides/slide1.xml", slide("", shape(radial(`<a:fillToRect l="0%" t="0%" r="100%" b="100%"/>`)), pic("rIdA", W / 2), pic("rIdB", 0)));
    zip.file("ppt/slides/_rels/slide1.xml.rels", `<Relationships><Relationship Id="rIdA" Target="../media/seal.png"/><Relationship Id="rIdB" Target="../media/photo.png"/></Relationships>`);
    zip.file("ppt/media/seal.png", "seal");
    zip.file("ppt/media/photo.png", "photo");
    const [css] = await pptxBackdropCss(await zip.generateAsync({ type: "uint8array" }), [{ index: 0, art: [{ x: 0.5, y: 0, w: 0.25, h: 0.25 }] }]);
    expect(css?.art).toEqual([{ src: `data:image/png;base64,${Buffer.from("seal").toString("base64")}`, x: 0.5, y: 0, w: 0.25, h: 0.25 }]);
  });
});
