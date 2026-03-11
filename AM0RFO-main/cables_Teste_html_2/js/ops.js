"use strict";

var CABLES=CABLES||{};
CABLES.OPS=CABLES.OPS||{};

var Ops=Ops || {};
Ops.Gl=Ops.Gl || {};
Ops.Ui=Ops.Ui || {};
Ops.Anim=Ops.Anim || {};
Ops.Math=Ops.Math || {};
Ops.Trigger=Ops.Trigger || {};
Ops.Graphics=Ops.Graphics || {};
Ops.Gl.Shader=Ops.Gl.Shader || {};
Ops.Gl.ImageCompose=Ops.Gl.ImageCompose || {};
Ops.Graphics.Meshes=Ops.Graphics.Meshes || {};



// **************************************************************
// 
// Ops.Gl.MainLoop_v2
// 
// **************************************************************

Ops.Gl.MainLoop_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    hdpi = op.inFloat("Max Pixel Density (DPR)", 2),
    fpsLimit = op.inValue("FPS Limit", 0),
    reduceFocusFPS = op.inValueBool("Reduce FPS unfocussed", false),
    clear = op.inValueBool("Transparent", false),
    active = op.inValueBool("Active", 1),
    inFocus = op.inValueBool("Focus canvas", 1),
    trigger = op.outTrigger("trigger"),
    width = op.outNumber("width"),
    height = op.outNumber("height"),
    outPixel = op.outNumber("Pixel Density");

op.onAnimFrame = render;
hdpi.onChange = updateHdpi;

const cgl = op.patch.cg = op.patch.cgl;
let rframes = 0;
let rframeStart = 0;
let timeOutTest = null;
let addedListener = false;
if (!op.patch.cgl) op.uiAttr({ "error": "No webgl cgl context" });

const identTranslate = vec3.create();
vec3.set(identTranslate, 0, 0, 0);
const identTranslateView = vec3.create();
vec3.set(identTranslateView, 0, 0, -2);

let firstTime = true;
let fsElement = null;
let winhasFocus = true;
let winVisible = true;
let lastFrame = -1;
let duplicate = 0;
window.addEventListener("blur", () => { winhasFocus = false; });
window.addEventListener("focus", () => { winhasFocus = true; });
document.addEventListener("visibilitychange", () => { winVisible = !document.hidden; });
if (CABLES.UI)gui.canvasManager.addCgContext(op.patch.cgl);

testMultiMainloop();

// op.patch.cgl.cgCanvas.forceAspect = 1.7777777;
op.patch.tempData.mainloopOp = this;

op.patch.cgl.canvas.classList.add("cablescontext");
op.patch.cgl.canvas.dataset.contextname = "cgl";
op.patch.cgl.canvas.dataset.api = "webgl";

if (CABLES.UI)gui.setLayout();

function updateHdpi()
{
    setPixelDensity();

    if (CABLES.UI)
    {
        if (hdpi.get() < 1)
            op.patch.cgl.canvas.style.imageRendering = "pixelated";
    }

    op.patch.cgl.updateSize();
    if (CABLES.UI) gui.setLayout();
}

active.onChange = function ()
{
    op.patch.removeOnAnimFrame(op);

    if (active.get())
    {
        op.setUiAttrib({ "extendTitle": "" });
        op.onAnimFrame = render;
        op.patch.addOnAnimFrame(op);
        op.log("adding again!");
    }
    else
    {
        op.setUiAttrib({ "extendTitle": "Inactive" });
    }
};

function getFpsLimit()
{
    if (reduceFocusFPS.get())
    {
        if (!winVisible) return 10;
        if (!winhasFocus) return 30;
    }

    return fpsLimit.get();
}

op.onDelete = function ()
{
    cgl.gl.clearColor(0, 0, 0.0, 0);
    cgl.gl.clear(cgl.gl.COLOR_BUFFER_BIT | cgl.gl.DEPTH_BUFFER_BIT);
};

function setPixelDensity()
{
    if (hdpi.get() != 0) op.patch.cgl.pixelDensity = Math.min(hdpi.get(), window.devicePixelRatio);
    else op.patch.cgl.pixelDensity = window.devicePixelRatio;
}

function render(time, frame, delta)
{
    if (frame === lastFrame)
    {
        if (duplicate < 10)console.warn("duplicate frame?!");
        duplicate++;
        return;
    }
    lastFrame = frame;

    if (!active.get()) return;
    if (cgl.aborted || cgl.canvas.clientWidth === 0 || cgl.canvas.clientHeight === 0) return;

    op.patch.cg = cgl;

    setPixelDensity();

    // if (hdpi.get())op.patch.cgl.pixelDensity = window.devicePixelRatio;

    const startTime = performance.now();

    op.patch.config.fpsLimit = getFpsLimit();

    if (cgl.canvasWidth == -1)
    {
        cgl.setCanvas(op.patch.config.glCanvasId);
        return;
    }

    if (cgl.canvasWidth != width.get() || cgl.canvasHeight != height.get())
    {
        width.set(cgl.canvasWidth / 1);
        height.set(cgl.canvasHeight / 1);
    }

    if (CABLES.now() - rframeStart > 1000)
    {
        CGL.fpsReport = CGL.fpsReport || [];
        if (op.patch.loading.getProgress() >= 1.0 && rframeStart !== 0)CGL.fpsReport.push(rframes);
        rframes = 0;
        rframeStart = CABLES.now();
    }
    cgl.lastShader = null;
    cgl.lastMesh = null;

    cgl.renderStart(cgl, identTranslate, identTranslateView);

    if (!clear.get()) cgl.gl.clearColor(0, 0, 0, 1);
    else cgl.gl.clearColor(0, 0, 0, 0);

    cgl.gl.clear(cgl.gl.COLOR_BUFFER_BIT | cgl.gl.DEPTH_BUFFER_BIT);

    trigger.trigger();

    if (cgl.lastMesh)cgl.lastMesh.unBind();

    if (CGL.Texture.previewTexture)
    {
        if (!CGL.Texture.texturePreviewer) CGL.Texture.texturePreviewer = new CGL.Texture.texturePreview(cgl);
        CGL.Texture.texturePreviewer.render(CGL.Texture.previewTexture);
    }
    cgl.renderEnd(cgl);

    op.patch.cg = null;

    if (!clear.get())
    {
        cgl.gl.clearColor(1, 1, 1, 1);
        cgl.gl.colorMask(false, false, false, true);
        cgl.gl.clear(cgl.gl.COLOR_BUFFER_BIT);
        cgl.gl.colorMask(true, true, true, true);
    }

    if (!cgl.tempData.phong)cgl.tempData.phong = {};
    rframes++;
    if (firstTime)
    {
        if (inFocus.get()) cgl.canvas.focus();
        firstTime = false;
    }

    outPixel.set(op.patch.cgl.pixelDensity);
    op.patch.cgl.profileData.profileMainloopMs = performance.now() - startTime;
}

function testMultiMainloop()
{
    clearTimeout(timeOutTest);
    timeOutTest = setTimeout(
        () =>
        {
            if (op.patch.getOpsByObjName(op.name).length > 1)
            {
                op.setUiError("multimainloop", "there should only be one mainloop op!");
                if (!addedListener)addedListener = op.patch.addEventListener("onOpDelete", testMultiMainloop);
            }
            else op.setUiError("multimainloop", null, 1);
        }, 500);
}

}
};






// **************************************************************
// 
// Ops.Graphics.Meshes.Circle_v3
// 
// **************************************************************

Ops.Graphics.Meshes.Circle_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("render"),
    radius = op.inValue("radius", 0.5),
    innerRadius = op.inValueSlider("innerRadius", 0),
    segments = op.inValueInt("segments", 40),
    percent = op.inValueSlider("percent", 1),
    steps = op.inValue("steps", 0),
    invertSteps = op.inValueBool("invertSteps", false),
    mapping = op.inSwitch("mapping", ["flat", "round"]),
    drawSpline = op.inValueBool("Spline", false),
    doRender = op.inValueBool("Draw", true),
    trigger = op.outTrigger("trigger"),
    geomOut = op.outObject("geometry", null, "geometry");

op.setPortGroup("Size", [radius, innerRadius]);
op.setPortGroup("Display", [percent, steps, invertSteps]);
op.toWorkShouldNotBeChild("Ops.Gl.TextureEffects.ImageCompose", CABLES.OP_PORT_TYPE_FUNCTION);

doRender.setUiAttribs({ "title": "Render mesh" });

mapping.set("flat");

mapping.onChange =
    segments.onChange =
    radius.onChange =
    innerRadius.onChange =
    percent.onChange =
    steps.onChange =
    invertSteps.onChange =
    drawSpline.onChange = calcLater;

geomOut.ignoreValueSerialize = true;
const cgl = op.patch.cgl;

let geom = new CGL.Geometry("circle");
let mesh = null;
const lastSegs = -1;

let oldPrim = 0;
let shader = null;
let needsCalc = true;

render.onTriggered = renderMesh;
op.onDelete = function () { if (mesh)mesh.dispose(); };

doRender.onChange = () => { op.setUiAttrib({ "extendTitle": doRender.get() ? "" : "x" }); };

op.preRender = () =>
{
    renderMesh();
};

render.onLinkChanged = function ()
{
    if (!render.isLinked()) geomOut.set(null);
    else geomOut.setRef(geom);
};

function renderMesh()
{
    if (!op.patch.cg) return;
    if (needsCalc)calc();

    if (!CGL.TextureEffect.checkOpNotInTextureEffect(op)) return;

    shader = op.patch.cg.getShader();
    if (!shader) return;
    oldPrim = shader.glPrimitive;

    if (drawSpline.get()) shader.glPrimitive = cgl.gl.LINE_STRIP;

    if (doRender.get() && mesh)
    {
        // mesh.instances = 3;
        mesh.render(shader);
    }
    trigger.trigger();

    shader.glPrimitive = oldPrim;
}

function calc()
{
    const segs = Math.max(3, Math.floor(segments.get()));

    geom.clear();

    const faces = [];
    const texCoords = [];
    const vertexNormals = [];
    const tangents = [];
    const biTangents = [];

    let i = 0, degInRad = 0;
    let oldPosX = 0, oldPosY = 0;
    let oldPosXTexCoord = 0, oldPosYTexCoord = 0;

    let oldPosXIn = 0, oldPosYIn = 0;
    let oldPosXTexCoordIn = 0, oldPosYTexCoordIn = 0;

    let posxTexCoordIn = 0, posyTexCoordIn = 0;
    let posxTexCoord = 0, posyTexCoord = 0;
    let posx = 0, posy = 0;

    const perc = Math.max(0.0, percent.get());
    const verts = [];

    if (drawSpline.get())
    {
        let lastX = 0;
        let lastY = 0;
        const tc = [];
        for (i = 0; i <= segs * perc; i++)
        {
            degInRad = (360 / segs) * i * CGL.DEG2RAD;
            posx = Math.cos(degInRad) * radius.get();
            posy = Math.sin(degInRad) * radius.get();

            posyTexCoord = 0.5;

            if (i > 0)
            {
                verts.push(lastX);
                verts.push(lastY);
                verts.push(0);
                posxTexCoord = 1.0 - (i - 1) / segs;

                tc.push(posxTexCoord, posyTexCoord);
            }
            verts.push(posx);
            verts.push(posy);
            verts.push(0);

            lastX = posx;
            lastY = posy;
        }
        geom.setPointVertices(verts);
    }
    else
    if (innerRadius.get() <= 0)
    {
        for (i = 0; i <= segs * perc; i++)
        {
            degInRad = (360 / segs) * i * CGL.DEG2RAD;
            posx = Math.cos(degInRad) * radius.get();
            posy = Math.sin(degInRad) * radius.get();

            if (mapping.get() == "flat")
            {
                posxTexCoord = (Math.cos(degInRad) + 1.0) / 2;
                posyTexCoord = 1.0 - (Math.sin(degInRad) + 1.0) / 2;
                posxTexCoordIn = 0.5;
                posyTexCoordIn = 0.5;
            }
            else if (mapping.get() == "round")
            {
                posxTexCoord = 1.0 - i / segs;
                posyTexCoord = 0;
                posxTexCoordIn = posxTexCoord;
                posyTexCoordIn = 1;
            }

            faces.push(
                [0, 0, 0],
                [oldPosX, oldPosY, 0],
                [posx, posy, 0]
            );

            texCoords.push(
                posxTexCoordIn, posyTexCoordIn, oldPosXTexCoord, oldPosYTexCoord, posxTexCoord, posyTexCoord
            );
            vertexNormals.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
            tangents.push(1, 0, 0, 1, 0, 0, 1, 0, 0);
            biTangents.push(0, -1, 0, 0, -1, 0, 0, -1, 0);

            oldPosXTexCoord = posxTexCoord;
            oldPosYTexCoord = posyTexCoord;

            oldPosX = posx;
            oldPosY = posy;
        }

        geom = CGL.Geometry.buildFromFaces(faces, "circle");
        geom.vertexNormals = vertexNormals;
        geom.tangents = tangents;
        geom.biTangents = biTangents;
        geom.texCoords = texCoords;
    }
    else
    {
        let count = 0;
        const numSteps = segs * perc;
        const pos = 0;

        for (i = 0; i <= numSteps; i++)
        {
            count++;

            degInRad = (360 / segs) * i * CGL.DEG2RAD;
            posx = Math.cos(degInRad) * radius.get();
            posy = Math.sin(degInRad) * radius.get();

            const posxIn = Math.cos(degInRad) * innerRadius.get() * radius.get();
            const posyIn = Math.sin(degInRad) * innerRadius.get() * radius.get();

            if (mapping.get() == "round")
            {
                posxTexCoord = 1.0 - i / segs;
                posyTexCoord = 0;
                posxTexCoordIn = posxTexCoord;
                posyTexCoordIn = 1;
            }

            if (steps.get() === 0.0 ||
                (count % parseInt(steps.get(), 10) === 0 && !invertSteps.get()) ||
                (count % parseInt(steps.get(), 10) !== 0 && invertSteps.get()))
            {
                faces.push(
                    [posxIn, posyIn, 0],
                    [oldPosX, oldPosY, 0],
                    [posx, posy, 0]
                );

                faces.push(
                    [oldPosXIn, oldPosYIn, 0],
                    [oldPosX, oldPosY, 0],
                    [posxIn, posyIn, 0]
                );

                texCoords.push(
                    posxTexCoord, 0, oldPosXTexCoord, 0, posxTexCoordIn, 1, posxTexCoord, 1, oldPosXTexCoord, 0, oldPosXTexCoordIn, 1);

                vertexNormals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
                tangents.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
                biTangents.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
            }

            oldPosXTexCoordIn = posxTexCoordIn;
            oldPosYTexCoordIn = posyTexCoordIn;

            oldPosXTexCoord = posxTexCoord;
            oldPosYTexCoord = posyTexCoord;

            oldPosX = posx;
            oldPosY = posy;

            oldPosXIn = posxIn;
            oldPosYIn = posyIn;
        }

        geom = CGL.Geometry.buildFromFaces(faces, "circle");
        geom.vertexNormals = vertexNormals;
        geom.tangents = tangents;
        geom.biTangents = biTangents;

        if (mapping.get() == "flat") geom.mapTexCoords2d();
        else geom.texCoords = texCoords;
    }

    geomOut.setRef(geom);

    if (geom.vertices.length == 0) return;
    if (mesh) mesh.dispose();
    mesh = null;
    if (op.patch.cg)
        mesh = op.patch.cg.createMesh(geom, { "opId": op.id });
    needsCalc = false;
}

function calcLater()
{
    needsCalc = true;
}

}
};






// **************************************************************
// 
// Ops.Trigger.TriggerOnChangeObject_v2
// 
// **************************************************************

Ops.Trigger.TriggerOnChangeObject_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    inval = op.inObject("Object"),
    next = op.outTrigger("Changed"),
    outObj = op.outObject("Result");

outObj.ignoreValueSerialize = true;

inval.onChange = function ()
{
    outObj.setRef(inval.get());
    next.trigger();
};

op.init = () =>
{
    if (inval.get())next.trigger();
};

}
};






// **************************************************************
// 
// Ops.Ui.VizObject
// 
// **************************************************************

Ops.Ui.VizObject= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
/* minimalcore:start */

const
    inObj = op.inObject("Object"),
    inConsole = op.inTriggerButton("console log"),
    inZoomText = op.inBool("ZoomText", false),
    inLineNums = op.inBool("Line Numbers", false),
    inSort = op.inBool("Sort Keys", false),
    inFontSize = op.inFloat("Font Size", 10),
    inPos = op.inFloatSlider("Scroll", 0);

let lines = [];
inConsole.setUiAttribs({ "hidePort": true });

op.setUiAttrib({ "height": 200, "width": 400, "resizable": true, "vizLayerMaxZoom": 3500 });

function myStringify(o, level = 0)
{
    let ind = "   ";
    let indent = "";

    let str = "";
    for (let i = 0; i < level; i++) indent += ind;

    if (level > 4)
    {
        return indent + "/* too deep... */";
    }

    if (typeof o === "string") str += "\"" + o + "\""; //  e.g. in arrays
    else if (typeof o === "number") str += o; //  e.g. in arrays
    else
    {
        // let keys = Object.keys(o);
        let keys = [];
        for (const kk in o) keys.push(kk);
        let numKeys = keys.length;

        if (inSort.get())
            if (!(Array.isArray(o) || (o.constructor && o.constructor.name === "Float32Array")))
                keys = keys.sort();

        try
        {
            if (numKeys == 0)
            {
                str += indent + "{}";
            }
            else
            {
                let keyCounter = 0;
                str += indent + "{\n";
                for (let i = 0; i < keys.length; i++)
                {
                    const item = o[keys[i]];

                    keyCounter++;
                    str += indent + ind;
                    str += "\"" + keys[i] + "\": ";

                    if (item === null)
                    {
                        str += "null";
                    }
                    else
                    if (item === undefined)
                    {
                        str += "undefined";
                    }
                    else
                    if (item === true)
                    {
                        str += "true";
                    }
                    else
                    if (item === false)
                    {
                        str += "false";
                    }
                    else
                    if (item === 0)
                    {
                        str += "0";
                    }
                    else
                    if (typeof item === "number")
                    {
                        str += String(item);
                    }
                    else if (typeof item === "string")
                    {
                        str += "\"" + item + "\"";
                    }
                    else if (item && (Array.isArray(item) || (item.constructor && item.constructor.name === "Float32Array")))
                    {
                        const maxItems = 5;
                        str += "{" + item.constructor.name + "[" + item.length + "]} ";
                        str += "[";
                        for (let a = 0; a < Math.min(maxItems, item.length); a++)
                        {
                            if (a > 0)str += ",";
                            try
                            {
                                str += myStringify(item[a], level + 1);
                            }
                            catch (e)
                            {
                            // console.log(e);
                                str += "exception:" + e.message;
                            }
                        }
                        if (item.length > maxItems)
                            str += ",/* ... " + (item.length - maxItems) + " more items */";
                        str += "]";
                    }
                    else if (item && item.constructor.name === "Object")
                    {
                        if (Object.keys(item).length == 0) str += "{}";
                        else str += "\n" + myStringify(item, level + 1);
                    }
                    else
                    if (!item)
                    {
                        str += "/*no item?*/";
                        console.log("no item????????", item);
                    }
                    else
                    {
                        if (item)
                        {
                            str += "[" + item.constructor.name + "]";
                            str += "\n" + myStringify(item, level + 1);
                        }
                        else
                        {
                            str += "??";
                        }
                    }

                    if (keyCounter != numKeys)str += ",";
                    str += "\n";
                }

                str += indent;
                str += "}";
            }
        }
        catch (e)
        {
            console.log(e);
        }
    }

    return str;
}

inObj.onChange = () =>
{
    let obj = inObj.get();
    let str = "???";
    if (obj && obj.getInfo) obj = obj.getInfo();

    if (obj && obj.constructor && obj.constructor.name != "Object") op.setUiAttribs({ "extendTitle": obj.constructor.name });

    if (obj === undefined)str = "undefined";
    else if (obj === null)str = "null";
    else if (obj === false)str = "false";
    else if (obj === 0)str = "0";
    else
        try
        {
            const cblStringify = Object.getPrototypeOf(obj).constructor.name == "Object";

            if (cblStringify) str = myStringify(obj);
            else
            {
                str = JSON.stringify(obj, false, 4);

                if (
                    obj.hasOwnProperty("isTrusted") && Object.keys(obj).length == 1 ||
            (str == "{}" && obj && obj.constructor && obj.constructor.name != "Object"))
                {
                    str = "could not stringify object: " + obj.constructor.name + "\n";

                    const o = {};
                    for (const i in obj)
                    {
                        if (!obj[i]) continue;

                        if (obj[i].constructor)
                        {
                            if (obj[i].constructor.name == "Number" || obj[i].constructor.name == "String" || obj[i].constructor.name == "Boolean")
                                o[i] = obj[i];
                        }
                        else
                            o[i] = "{???}";
                    }
                    obj = o;
                    str = JSON.stringify(obj, false, 4);
                }
            }
        }
        catch (e)
        {
            str = "object can not be displayed as string\n" + e.message;
            // console.log(obj);
        }

    if (obj && obj.constructor && (obj.constructor.name == "String" || CABLES.isNumeric(obj) || Array.isArray(obj)))
    {
        op.setUiError("notobj", "The connected is not of type object! ", 1);
        str += "\nnot an object!\n";
    }
    else op.setUiError("notobj", null);

    str = String(str);
    lines = str.split("\n");
};

inObj.onLinkChanged = () =>
{
    if (inObj.isLinked())
    {
        const p = inObj.links[0].getOtherPort(inObj);

        op.setUiAttrib({ "extendTitle": p.uiAttribs.objType });
    }
};

inConsole.onTriggered = () =>
{
    console.info(inObj.get());
};

op.renderVizLayer = (ctx, layer, viz) =>
{
    viz.clear(ctx, layer);

    ctx.save();
    ctx.scale(layer.scale, layer.scale);

    viz.renderText(ctx, layer, lines, {
        "zoomText": inZoomText.get(),
        "showLineNum": inLineNums.get(),
        "syntax": "js",
        "fontSize": inFontSize.get(),
        "scroll": inPos.get()
    });

    ctx.restore();
};

/* minimalcore:end */

}
};






// **************************************************************
// 
// Ops.Trigger.Sequence
// 
// **************************************************************

Ops.Trigger.Sequence= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    exe = op.inTrigger("exe"),
    cleanup = op.inTriggerButton("Clean up connections");

op.setUiAttrib({ "resizable": true, "resizableY": false, "stretchPorts": true });
const
    exes = [],
    triggers = [],
    num = 16;

let
    updateTimeout = null,
    connectedOuts = [];

exe.onTriggered = triggerAll;
cleanup.onTriggered = clean;
cleanup.setUiAttribs({ "hideParam": true, "hidePort": true });

for (let i = 0; i < num; i++)
{
    const p = op.outTrigger("trigger " + i);
    triggers.push(p);
    p.onLinkChanged = updateButton;

    if (i < num - 1)
    {
        let newExe = op.inTrigger("exe " + i);
        newExe.onTriggered = triggerAll;
        exes.push(newExe);
    }
}

updateConnected();

function updateConnected()
{
    connectedOuts.length = 0;
    for (let i = 0; i < triggers.length; i++)
        if (triggers[i].links.length > 0) connectedOuts.push(triggers[i]);
}

function updateButton()
{
    updateConnected();
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() =>
    {
        let show = false;
        for (let i = 0; i < triggers.length; i++)
            if (triggers[i].links.length > 1) show = true;

        cleanup.setUiAttribs({ "hideParam": !show });

        if (op.isCurrentUiOp()) op.refreshParams();
    }, 60);
}

function triggerAll()
{
    // for (let i = 0; i < triggers.length; i++) triggers[i].trigger();
    for (let i = 0; i < connectedOuts.length; i++) connectedOuts[i].trigger();
}

function clean()
{
    let count = 0;
    for (let i = 0; i < triggers.length; i++)
    {
        let removeLinks = [];

        if (triggers[i].links.length > 1)
            for (let j = 1; j < triggers[i].links.length; j++)
            {
                while (triggers[count].links.length > 0) count++;

                removeLinks.push(triggers[i].links[j]);
                const otherPort = triggers[i].links[j].getOtherPort(triggers[i]);
                op.patch.link(op, "trigger " + count, otherPort.op, otherPort.name);
                count++;
            }

        for (let j = 0; j < removeLinks.length; j++) removeLinks[j].remove();
    }
    updateButton();
    updateConnected();
}

}
};






// **************************************************************
// 
// Ops.Gl.CanvasInfo_v3
// 
// **************************************************************

Ops.Gl.CanvasInfo_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    width = op.outNumber("CSS Width"),
    height = op.outNumber("CSS Height"),
    pixelRatio = op.outNumber("Pixel Ratio"),
    widthPixel = op.outNumber("Pixel Width"),
    heightPixel = op.outNumber("Pixel Height"),
    aspect = op.outNumber("Aspect Ratio"),
    landscape = op.outBool("Landscape"),
    outCanvasEle = op.outObject("Canvas", null, "element"),
    outCanvasParentEle = op.outObject("Canvas Parent", null, "element"),
    outResize = op.outTrigger("Resized");

let cgl = op.patch.cgl;
outCanvasEle.setRef(op.patch.cgl.canvas);
outCanvasParentEle.setRef(op.patch.cgl.canvas.parentElement);

cgl.on("resize", () =>
{
    outResize.trigger();
    update();
});

update();

function update()
{
    let div = 1;

    if (cgl.canvasHeight == 0)setTimeout(update, 100);

    height.set(cgl.canvasHeight / op.patch.cgl.pixelDensity);
    width.set(cgl.canvasWidth / op.patch.cgl.pixelDensity);

    widthPixel.set(cgl.canvasWidth);
    heightPixel.set(cgl.canvasHeight);

    pixelRatio.set(op.patch.cgl.pixelDensity); // window.devicePixelRatio

    aspect.set(cgl.canvasWidth / cgl.canvasHeight);
    landscape.set(cgl.canvasWidth > cgl.canvasHeight ? 1 : 0);
}

}
};






// **************************************************************
// 
// Ops.Math.Divide
// 
// **************************************************************

Ops.Math.Divide= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    number1 = op.inValueFloat("number1", 1),
    number2 = op.inValueFloat("number2", 2),
    result = op.outNumber("result");

op.setUiAttribs({ "mathTitle": true });

number1.onChange = number2.onChange = exec;
exec();

function exec()
{
    result.set(number1.get() / number2.get());
}

}
};






// **************************************************************
// 
// Ops.Gl.ImageCompose.ImageCompose_v4
// 
// **************************************************************

Ops.Gl.ImageCompose.ImageCompose_v4= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={"imgcomp_frag":"IN vec2 texCoord;\nUNI vec4 bgColor;\nUNI sampler2D tex;\n#ifdef USE_UVTEX\nUNI sampler2D UVTex;\n#endif\n\nvoid main()\n{\n\n    #ifndef USE_TEX\n        outColor=bgColor;\n    #endif\n    #ifdef USE_TEX\n        #ifndef USE_UVTEX\n        outColor=texture(tex,texCoord);\n        #else\n        outColor=texture(tex,texture(UVTex,texCoord).xy);\n        #endif\n    #endif\n\n\n\n}\n",};
const
    cgl = op.patch.cgl,
    render = op.inTrigger("Render"),
    inTex = op.inTexture("Base Texture"),
    inUVTex = op.inTexture("UV Texture"),
    inSize = op.inSwitch("Size", ["Auto", "Canvas", "Manual"], "Auto"),
    width = op.inValueInt("Width", 640),
    height = op.inValueInt("Height", 480),
    inFilter = op.inSwitch("Filter", ["nearest", "linear", "mipmap"], "linear"),
    inWrap = op.inValueSelect("Wrap", ["clamp to edge", "repeat", "mirrored repeat"], "repeat"),
    aniso = op.inSwitch("Anisotropic", ["0", "1", "2", "4", "8", "16"], "0"),

    inPixelFormat = op.inDropDown("Pixel Format", CGL.Texture.PIXELFORMATS, CGL.Texture.PFORMATSTR_RGBA8UB),

    inClear = op.inBool("Clear", true),
    r = op.inValueSlider("R", 0),
    g = op.inValueSlider("G", 0),
    b = op.inValueSlider("B", 0),
    a = op.inValueSlider("A", 0),

    trigger = op.outTrigger("Next"),
    texOut = op.outTexture("texture_out", CGL.Texture.getEmptyTexture(cgl)),
    outRatio = op.outNumber("Aspect Ratio"),
    outWidth = op.outNumber("Texture Width"),
    outHeight = op.outNumber("Texture Height");

op.setPortGroup("Texture Size", [inSize, width, height]);
op.setPortGroup("Texture Parameters", [inWrap, aniso, inFilter, inPixelFormat]);

r.setUiAttribs({ "colorPick": true });
op.setPortGroup("Color", [r, g, b, a, inClear]);

op.toWorkPortsNeedToBeLinked(render);

const prevViewPort = [0, 0, 0, 0];
let effect = null;
let tex = null;
let reInitEffect = true;
let isFloatTex = false;
let copyShader = null;
let copyShaderTexUni = null;
let copyShaderUVTexUni = null;
let copyShaderRGBAUni = null;

inWrap.onChange =
inFilter.onChange =
aniso.onChange =
inPixelFormat.onChange = reInitLater;

inTex.onLinkChanged =
inClear.onChange =
    inSize.onChange =
    inUVTex.onChange = updateUi;

render.onTriggered =
    op.preRender = doRender;

updateUi();

function initEffect()
{
    if (effect)effect.delete();
    if (tex)tex.delete();
    tex = null;
    effect = new CGL.TextureEffect(cgl, { "isFloatingPointTexture": CGL.Texture.isPixelFormatFloat(inPixelFormat.get()), "name": op.name });

    const cgl_aniso = Math.min(cgl.maxAnisotropic, parseFloat(aniso.get()));

    tex = new CGL.Texture(cgl,
        {
            "anisotropic": cgl_aniso,
            "name": "image_compose_v2_" + op.id,
            "pixelFormat": inPixelFormat.get(),
            "filter": getFilter(),
            "wrap": getWrap(),
            "width": getWidth(),
            "height": getHeight()
        });

    effect.setSourceTexture(tex);

    outWidth.set(getWidth());
    outHeight.set(getHeight());
    outRatio.set(getWidth() / getHeight());

    texOut.setRef(CGL.Texture.getEmptyTexture(cgl));

    reInitEffect = false;
    updateUi();
}

function getFilter()
{
    if (inFilter.get() == "nearest") return CGL.Texture.FILTER_NEAREST;
    else if (inFilter.get() == "linear") return CGL.Texture.FILTER_LINEAR;
    else if (inFilter.get() == "mipmap") return CGL.Texture.FILTER_MIPMAP;
}

function getWrap()
{
    if (inWrap.get() == "repeat") return CGL.Texture.WRAP_REPEAT;
    else if (inWrap.get() == "mirrored repeat") return CGL.Texture.WRAP_MIRRORED_REPEAT;
    else if (inWrap.get() == "clamp to edge") return CGL.Texture.WRAP_CLAMP_TO_EDGE;
}

function getWidth()
{
    let x = 0;
    if (inTex.get() && inSize.get() == "Auto") x = inTex.get().width;
    else if (inSize.get() == "Auto" || inSize.get() == "Canvas") x = cgl.canvasWidth;
    else if (inSize.get() == "ViewPort") x = cgl.getViewPort()[2];
    else x = Math.ceil(width.get());
    return op.patch.cgl.checkTextureSize(x);
}

function getHeight()
{
    let x = 0;

    if (inTex.get() && inSize.get() == "Auto") x = inTex.get().height;
    else if (inSize.get() == "Auto" || inSize.get() == "Canvas") x = cgl.canvasHeight;
    else if (inSize.get() == "ViewPort") x = cgl.getViewPort()[3];
    else x = Math.ceil(height.get());
    return op.patch.cgl.checkTextureSize(x);
}

function reInitLater()
{
    reInitEffect = true;
}

function updateResolution()
{
    if ((
        getWidth() != tex.width ||
        getHeight() != tex.height ||
        // tex.anisotropic != parseFloat(aniso.get()) ||
        // tex.isFloatingPoint() != CGL.Texture.isPixelFormatFloat(inPixelFormat.get()) ||
        tex.pixelFormat != inPixelFormat.get() ||
        tex.filter != getFilter() ||
        tex.wrap != getWrap()
    ) && (getWidth() !== 0 && getHeight() !== 0))
    {
        initEffect();
        effect.setSourceTexture(tex);
        // texOut.set(CGL.Texture.getEmptyTexture(cgl));
        texOut.setRef(tex);
        updateResolutionInfo();
        checkTypes();
    }
}

function updateResolutionInfo()
{
    let info = null;

    if (inSize.get() == "Manual")
    {
        info = null;
    }
    else if (inSize.get() == "Auto")
    {
        if (inTex.get()) info = "Input Texture";
        else info = "Canvas Size";

        info += ": " + getWidth() + " x " + getHeight();
    }

    let changed = false;
    changed = inSize.uiAttribs.info != info;
    inSize.setUiAttribs({ "info": info });
    if (changed)op.refreshParams();
}

function updateDefines()
{
    if (copyShader)copyShader.toggleDefine("USE_TEX", inTex.isLinked() || !inClear.get());
    if (copyShader)copyShader.toggleDefine("USE_UVTEX", inUVTex.isLinked());
}

function updateUi()
{
    aniso.setUiAttribs({ "greyout": getFilter() != CGL.Texture.FILTER_MIPMAP });

    r.setUiAttribs({ "greyout": inTex.isLinked() });
    b.setUiAttribs({ "greyout": inTex.isLinked() });
    g.setUiAttribs({ "greyout": inTex.isLinked() });
    a.setUiAttribs({ "greyout": inTex.isLinked() });

    inClear.setUiAttribs({ "greyout": inTex.isLinked() });
    width.setUiAttribs({ "greyout": inSize.get() != "Manual" });
    height.setUiAttribs({ "greyout": inSize.get() != "Manual" });

    // width.setUiAttribs({ "hideParam": inSize.get() != "Manual" });
    // height.setUiAttribs({ "hideParam": inSize.get() != "Manual" });

    if (tex)
        if (CGL.Texture.isPixelFormatFloat(inPixelFormat.get()) && getFilter() == CGL.Texture.FILTER_MIPMAP) op.setUiError("fpmipmap", "Don't use mipmap and 32bit at the same time, many systems do not support this.", 1);
        else op.setUiError("fpmipmap", null);

    updateResolutionInfo();
    updateDefines();
    checkTypes();
}

function checkTypes()
{
    if (tex)
        if (inTex.isLinked() && inTex.get() && (tex.isFloatingPoint() < inTex.get().isFloatingPoint()))
            op.setUiError("textypediff", "Warning: Mixing floating point and non floating point texture can result in data/precision loss", 1);
        else
            op.setUiError("textypediff", null);
}

op.preRender = () =>
{
    doRender();
};

function copyTexture()
{
    if (!copyShader)
    {
        copyShader = new CGL.Shader(cgl, "copytextureshader");
        copyShader.setSource(copyShader.getDefaultVertexShader(), attachments.imgcomp_frag);
        copyShaderTexUni = new CGL.Uniform(copyShader, "t", "tex", 0);
        copyShaderUVTexUni = new CGL.Uniform(copyShader, "t", "UVTex", 1);
        copyShaderRGBAUni = new CGL.Uniform(copyShader, "4f", "bgColor", r, g, b, a);
        updateDefines();
    }

    cgl.pushShader(copyShader);
    cgl.currentTextureEffect.bind();

    if (inTex.get()) cgl.setTexture(0, inTex.get().tex);
    else if (!inClear.get() && texOut.get()) cgl.setTexture(0, texOut.get().tex);
    if (inUVTex.get()) cgl.setTexture(1, inUVTex.get().tex);

    cgl.currentTextureEffect.finish();
    cgl.popShader();
}

function doRender()
{
    if (!effect || reInitEffect) initEffect();

    cgl.pushBlend(false);

    updateResolution();

    const oldEffect = cgl.currentTextureEffect;
    cgl.currentTextureEffect = effect;
    cgl.currentTextureEffect.imgCompVer = 3;
    cgl.currentTextureEffect.width = width.get();
    cgl.currentTextureEffect.height = height.get();
    effect.setSourceTexture(tex);

    effect.startEffect(inTex.get() || CGL.Texture.getEmptyTexture(cgl, isFloatTex), true);
    copyTexture();

    trigger.trigger();

    cgl.pushViewPort(0, 0, width.get(), height.get());

    effect.endEffect();
    texOut.setRef(effect.getCurrentSourceTexture());

    cgl.popViewPort();

    cgl.popBlend();
    cgl.currentTextureEffect = oldEffect;
}

}
};






// **************************************************************
// 
// Ops.Gl.ImageCompose.DrawImage_v3
// 
// **************************************************************

Ops.Gl.ImageCompose.DrawImage_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={"drawimage_frag":"#ifdef HAS_TEXTURES\n    IN vec2 texCoord;\n    UNI sampler2D tex;\n    UNI sampler2D image;\n#endif\n\n#ifdef TEX_TRANSFORM\n    IN mat3 transform;\n#endif\n// UNI float rotate;\n\n{{CGL.BLENDMODES}}\n\n#ifdef HAS_TEXTUREALPHA\n   UNI sampler2D imageAlpha;\n#endif\n\nUNI float amount;\n\n#ifdef ASPECT_RATIO\n    UNI float aspectTex;\n    UNI float aspectPos;\n#endif\n\nvoid main()\n{\n    vec4 blendRGBA=vec4(0.0,0.0,0.0,1.0);\n\n    #ifdef HAS_TEXTURES\n        vec2 tc=texCoord;\n\n        #ifdef TEX_FLIP_X\n            tc.x=1.0-tc.x;\n        #endif\n        #ifdef TEX_FLIP_Y\n            tc.y=1.0-tc.y;\n        #endif\n\n        #ifdef ASPECT_RATIO\n            #ifdef ASPECT_AXIS_X\n                tc.y=(1.0-aspectPos)-(((1.0-aspectPos)-tc.y)*aspectTex);\n            #endif\n            #ifdef ASPECT_AXIS_Y\n                tc.x=(1.0-aspectPos)-(((1.0-aspectPos)-tc.x)/aspectTex);\n            #endif\n        #endif\n\n        #ifdef TEX_TRANSFORM\n            vec3 coordinates=vec3(tc.x, tc.y,1.0);\n            tc=(transform * coordinates ).xy;\n        #endif\n\n        blendRGBA=texture(image,tc);\n\n        vec3 blend=blendRGBA.rgb;\n        vec4 baseRGBA=texture(tex,texCoord);\n        vec3 base=baseRGBA.rgb;\n\n\n        #ifdef PREMUL\n            blend.rgb = (blend.rgb) + (base.rgb * (1.0 - blendRGBA.a));\n        #endif\n\n        vec3 colNew=_blend(base,blend);\n\n\n\n\n        #ifdef REMOVE_ALPHA_SRC\n            blendRGBA.a=1.0;\n        #endif\n\n        #ifdef HAS_TEXTUREALPHA\n            vec4 colImgAlpha=texture(imageAlpha,tc);\n            float colImgAlphaAlpha=colImgAlpha.a;\n\n            #ifdef ALPHA_FROM_LUMINANCE\n                vec3 gray = vec3(dot(vec3(0.2126,0.7152,0.0722), colImgAlpha.rgb ));\n                colImgAlphaAlpha=(gray.r+gray.g+gray.b)/3.0;\n            #endif\n\n            #ifdef ALPHA_FROM_INV_UMINANCE\n                vec3 gray = vec3(dot(vec3(0.2126,0.7152,0.0722), colImgAlpha.rgb ));\n                colImgAlphaAlpha=1.0-(gray.r+gray.g+gray.b)/3.0;\n            #endif\n\n            #ifdef INVERT_ALPHA\n                colImgAlphaAlpha=clamp(colImgAlphaAlpha,0.0,1.0);\n                colImgAlphaAlpha=1.0-colImgAlphaAlpha;\n            #endif\n\n            blendRGBA.a=colImgAlphaAlpha*blendRGBA.a;\n        #endif\n    #endif\n\n    float am=amount;\n\n    #ifdef CLIP_REPEAT\n        if(tc.y>1.0 || tc.y<0.0 || tc.x>1.0 || tc.x<0.0)\n        {\n            // colNew.rgb=vec3(0.0);\n            am=0.0;\n        }\n    #endif\n\n    #ifdef ASPECT_RATIO\n        #ifdef ASPECT_CROP\n            if(tc.y>1.0 || tc.y<0.0 || tc.x>1.0 || tc.x<0.0)\n            {\n                colNew.rgb=base.rgb;\n                am=0.0;\n            }\n\n        #endif\n    #endif\n\n\n\n    #ifndef PREMUL\n        blendRGBA.rgb=mix(colNew,base,1.0-(am*blendRGBA.a));\n        blendRGBA.a=clamp(baseRGBA.a+(blendRGBA.a*am),0.,1.);\n    #endif\n\n    #ifdef PREMUL\n        // premultiply\n        // blendRGBA.rgb = (blendRGBA.rgb) + (baseRGBA.rgb * (1.0 - blendRGBA.a));\n        blendRGBA=vec4(\n            mix(colNew.rgb,base,1.0-(am*blendRGBA.a)),\n            blendRGBA.a*am+baseRGBA.a\n            );\n    #endif\n\n    #ifdef ALPHA_MASK\n    blendRGBA.a=baseRGBA.a;\n    #endif\n\n    outColor=blendRGBA;\n}\n\n\n\n\n\n\n\n","drawimage_vert":"IN vec3 vPosition;\nIN vec2 attrTexCoord;\nIN vec3 attrVertNormal;\n\nUNI mat4 projMatrix;\nUNI mat4 mvMatrix;\n\nOUT vec2 texCoord;\n// OUT vec3 norm;\n\n#ifdef TEX_TRANSFORM\n    UNI float posX;\n    UNI float posY;\n    UNI float scaleX;\n    UNI float scaleY;\n    UNI float rotate;\n    OUT mat3 transform;\n#endif\n\nvoid main()\n{\n   texCoord=attrTexCoord;\n//   norm=attrVertNormal;\n\n   #ifdef TEX_TRANSFORM\n        vec3 coordinates=vec3(attrTexCoord.x, attrTexCoord.y,1.0);\n        float angle = radians( rotate );\n        vec2 scale= vec2(scaleX,scaleY);\n        vec2 translate= vec2(posX,posY);\n\n        transform = mat3(   scale.x * cos( angle ), scale.x * sin( angle ), 0.0,\n            - scale.y * sin( angle ), scale.y * cos( angle ), 0.0,\n            - 0.5 * scale.x * cos( angle ) + 0.5 * scale.y * sin( angle ) - 0.5 * translate.x*2.0 + 0.5,  - 0.5 * scale.x * sin( angle ) - 0.5 * scale.y * cos( angle ) - 0.5 * translate.y*2.0 + 0.5, 1.0);\n   #endif\n\n   gl_Position = projMatrix * mvMatrix * vec4(vPosition,  1.0);\n}\n",};
const
    render = op.inTrigger("render"),
    blendMode = CGL.TextureEffect.AddBlendSelect(op, "blendMode"),
    amount = op.inValueSlider("amount", 1),

    image = op.inTexture("Image"),
    inAlphaPremul = op.inValueBool("Premultiplied", false),
    inAlphaMask = op.inValueBool("Alpha Mask", false),
    removeAlphaSrc = op.inValueBool("removeAlphaSrc", false),

    imageAlpha = op.inTexture("Mask"),
    alphaSrc = op.inValueSelect("Mask Src", ["alpha channel", "luminance", "luminance inv"], "luminance"),
    invAlphaChannel = op.inBool("Invert alpha channel"),

    inAspect = op.inValueBool("Aspect Ratio", false),
    inAspectAxis = op.inValueSelect("Stretch Axis", ["X", "Y"], "X"),
    inAspectPos = op.inValueSlider("Position", 0.0),
    inAspectCrop = op.inValueBool("Crop", false),

    trigger = op.outTrigger("trigger");

blendMode.set("normal");
const cgl = op.patch.cgl;
const shader = new CGL.Shader(cgl, "drawimage");

imageAlpha.onLinkChanged = updateAlphaPorts;

op.setPortGroup("Aspect Ratio", [inAspect, inAspectPos, inAspectCrop, inAspectAxis]);
op.setPortGroup("Mask", [imageAlpha, alphaSrc, invAlphaChannel]);

function updateAlphaPorts()
{
    if (imageAlpha.isLinked())
    {
        removeAlphaSrc.setUiAttribs({ "greyout": true });
        alphaSrc.setUiAttribs({ "greyout": false });
        invAlphaChannel.setUiAttribs({ "greyout": false });
    }
    else
    {
        removeAlphaSrc.setUiAttribs({ "greyout": false });
        alphaSrc.setUiAttribs({ "greyout": true });
        invAlphaChannel.setUiAttribs({ "greyout": true });
    }
}

op.toWorkPortsNeedToBeLinked(image);

shader.setSource(attachments.drawimage_vert, attachments.drawimage_frag);

const
    textureUniform = new CGL.Uniform(shader, "t", "tex", 0),
    textureImaghe = new CGL.Uniform(shader, "t", "image", 1),
    textureAlpha = new CGL.Uniform(shader, "t", "imageAlpha", 2),
    uniTexAspect = new CGL.Uniform(shader, "f", "aspectTex", 1),
    uniAspectPos = new CGL.Uniform(shader, "f", "aspectPos", inAspectPos);

inAspect.onChange =
    inAspectCrop.onChange =
    inAspectAxis.onChange = updateAspectRatio;

function updateAspectRatio()
{
    shader.removeDefine("ASPECT_AXIS_X");
    shader.removeDefine("ASPECT_AXIS_Y");
    shader.removeDefine("ASPECT_CROP");

    inAspectPos.setUiAttribs({ "greyout": !inAspect.get() });
    inAspectCrop.setUiAttribs({ "greyout": !inAspect.get() });
    inAspectAxis.setUiAttribs({ "greyout": !inAspect.get() });

    if (inAspect.get())
    {
        shader.define("ASPECT_RATIO");

        if (inAspectCrop.get()) shader.define("ASPECT_CROP");

        if (inAspectAxis.get() == "X") shader.define("ASPECT_AXIS_X");
        if (inAspectAxis.get() == "Y") shader.define("ASPECT_AXIS_Y");
    }
    else
    {
        shader.removeDefine("ASPECT_RATIO");
        if (inAspectCrop.get()) shader.define("ASPECT_CROP");

        if (inAspectAxis.get() == "X") shader.define("ASPECT_AXIS_X");
        if (inAspectAxis.get() == "Y") shader.define("ASPECT_AXIS_Y");
    }
}

//
// texture flip
//
const flipX = op.inValueBool("flip x");
const flipY = op.inValueBool("flip y");

//
// texture transform
//

let doTransform = op.inValueBool("Transform");

let scaleX = op.inValueSlider("Scale X", 1);
let scaleY = op.inValueSlider("Scale Y", 1);

let posX = op.inValue("Position X", 0);
let posY = op.inValue("Position Y", 0);

let rotate = op.inValue("Rotation", 0);

const inClipRepeat = op.inValueBool("Clip Repeat", false);

const uniScaleX = new CGL.Uniform(shader, "f", "scaleX", scaleX);
const uniScaleY = new CGL.Uniform(shader, "f", "scaleY", scaleY);
const uniPosX = new CGL.Uniform(shader, "f", "posX", posX);
const uniPosY = new CGL.Uniform(shader, "f", "posY", posY);
const uniRotate = new CGL.Uniform(shader, "f", "rotate", rotate);

doTransform.onChange = updateTransformPorts;

function updateTransformPorts()
{
    shader.toggleDefine("TEX_TRANSFORM", doTransform.get());

    scaleX.setUiAttribs({ "greyout": !doTransform.get() });
    scaleY.setUiAttribs({ "greyout": !doTransform.get() });
    posX.setUiAttribs({ "greyout": !doTransform.get() });
    posY.setUiAttribs({ "greyout": !doTransform.get() });
    rotate.setUiAttribs({ "greyout": !doTransform.get() });
}

CGL.TextureEffect.setupBlending(op, shader, blendMode, amount);

const amountUniform = new CGL.Uniform(shader, "f", "amount", amount);

render.onTriggered = doRender;

inClipRepeat.onChange =
    imageAlpha.onChange =
    inAlphaPremul.onChange =
    inAlphaMask.onChange =
    invAlphaChannel.onChange =
    flipY.onChange =
    flipX.onChange =
    removeAlphaSrc.onChange =
    alphaSrc.onChange = updateDefines;

updateTransformPorts();
updateAlphaPorts();
updateAspectRatio();
updateDefines();

function updateDefines()
{
    shader.toggleDefine("REMOVE_ALPHA_SRC", removeAlphaSrc.get());
    shader.toggleDefine("ALPHA_MASK", inAlphaMask.get());

    shader.toggleDefine("CLIP_REPEAT", inClipRepeat.get());

    shader.toggleDefine("HAS_TEXTUREALPHA", imageAlpha.get() && imageAlpha.get().tex);

    shader.toggleDefine("TEX_FLIP_X", flipX.get());
    shader.toggleDefine("TEX_FLIP_Y", flipY.get());

    shader.toggleDefine("INVERT_ALPHA", invAlphaChannel.get());

    shader.toggleDefine("ALPHA_FROM_LUMINANCE", alphaSrc.get() == "luminance");
    shader.toggleDefine("ALPHA_FROM_INV_UMINANCE", alphaSrc.get() == "luminance_inv");
    shader.toggleDefine("PREMUL", inAlphaPremul.get());
}

function doRender()
{
    if (!CGL.TextureEffect.checkOpInEffect(op)) return;

    const tex = image.get();
    if (tex && tex.tex && amount.get() > 0.0)
    {
        cgl.pushShader(shader);
        cgl.currentTextureEffect.bind();

        const imgTex = cgl.currentTextureEffect.getCurrentSourceTexture();
        cgl.setTexture(0, imgTex.tex);

        // if (imgTex && tex)
        // {
        //     if (tex.textureType != imgTex.textureType && (tex.textureType == CGL.Texture.TYPE_FLOAT))
        //         op.setUiError("textypediff", "Drawing 32bit texture into an 8 bit can result in data/precision loss", 1);
        //     else
        //         op.setUiError("textypediff", null);
        // }

        const asp = 1 / (cgl.currentTextureEffect.getWidth() / cgl.currentTextureEffect.getHeight()) * (tex.width / tex.height);
        // uniTexAspect.setValue(1 / (tex.height / tex.width * imgTex.width / imgTex.height));

        uniTexAspect.setValue(asp);

        cgl.setTexture(1, tex.tex);
        // cgl.gl.bindTexture(cgl.gl.TEXTURE_2D, image.get().tex );

        if (imageAlpha.get() && imageAlpha.get().tex)
        {
            cgl.setTexture(2, imageAlpha.get().tex);
            // cgl.gl.bindTexture(cgl.gl.TEXTURE_2D, imageAlpha.get().tex );
        }

        // cgl.pushBlend(false);

        cgl.pushBlendMode(CGL.BLEND_NONE, true);

        cgl.currentTextureEffect.finish();
        cgl.popBlendMode();

        // cgl.popBlend();

        cgl.popShader();
    }

    trigger.trigger();
}

}
};






// **************************************************************
// 
// Ops.Graphics.OrbitControls_v3
// 
// **************************************************************

Ops.Graphics.OrbitControls_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("render"),
    minDist = op.inValueFloat("min distance", 1),
    maxDist = op.inValueFloat("max distance", 999999),

    minRotY = op.inValue("min rot y", 0),
    maxRotY = op.inValue("max rot y", 0),

    initialRadius = op.inValue("initial radius", 2),
    initialAxis = op.inValueSlider("initial axis y", 0.5),
    initialX = op.inValueSlider("initial axis x", 0.25),

    smoothness = op.inValueSlider("Smoothness", 1.0),
    speedX = op.inValue("Speed X", 1),
    speedY = op.inValue("Speed Y", 1),

    active = op.inValueBool("Active", true),

    allowPanning = op.inValueBool("Allow Panning", true),
    allowZooming = op.inValueBool("Allow Zooming", true),
    allowRotation = op.inValueBool("Allow Rotation", true),
    restricted = op.inValueBool("restricted", true),
    inIdentity = op.inBool("Identity", true),
    inReset = op.inTriggerButton("Reset"),

    trigger = op.outTrigger("trigger"),
    outRadius = op.outNumber("radius"),
    outXDeg = op.outNumber("Rot X"),
    outYDeg = op.outNumber("Rot Y");
    // outCoords = op.outArray("Eye/Target Pos");

op.setPortGroup("Initial Values", [initialAxis, initialX, initialRadius]);
op.setPortGroup("Interaction", [smoothness, speedX, speedY]);
op.setPortGroup("Boundaries", [minRotY, maxRotY, minDist, maxDist]);

const halfCircle = Math.PI;
const fullCircle = Math.PI * 2;

const
    vUp = vec3.create(),
    vCenter = vec3.create(),
    viewMatrix = mat4.create(),
    tempViewMatrix = mat4.create(),
    vOffset = vec3.create(),
    finalEyeAbs = vec3.create(),
    tempEye = vec3.create(),
    finalEye = vec3.create(),
    tempCenter = vec3.create(),
    finalCenter = vec3.create();

let eye = vec3.create(),
    mouseDown = false,
    radius = 5,
    lastMouseX = 0, lastMouseY = 0,
    percX = 0, percY = 0,
    px = 0,
    py = 0,
    divisor = 1,
    element = null,
    initializing = true,
    eyeTargetCoord = [0, 0, 0, 0, 0, 0],
    lastPy = 0;

op.onDelete = unbind;
smoothness.onChange = updateSmoothness;
initialRadius.onChange =
    inReset.onTriggered = reset;

eye = circlePos(0);
vec3.set(vCenter, 0, 0, 0);
vec3.set(vUp, 0, 1, 0);
updateSmoothness();
reset();

function reset()
{
    let off = 0;

    if (px % fullCircle < -halfCircle)
    {
        off = -fullCircle;
        px %= -fullCircle;
    }
    else
    if (px % fullCircle > halfCircle)
    {
        off = fullCircle;
        px %= fullCircle;
    }
    else px %= fullCircle;

    py %= (Math.PI);

    vec3.set(vOffset, 0, 0, 0);
    vec3.set(vCenter, 0, 0, 0);
    vec3.set(vUp, 0, 1, 0);

    percX = (initialX.get() * Math.PI * 2 + off);
    percY = (initialAxis.get() - 0.5);

    radius = initialRadius.get();
    eye = circlePos(percY);
}

function updateSmoothness()
{
    divisor = smoothness.get() * 10 + 1;
}

function ip(val, goal)
{
    if (initializing) return goal;
    return val + (goal - val) / divisor;
}

render.onTriggered = function ()
{
    const cgl = op.patch.cg;
    if (!cgl) return;

    if (!element)
    {
        setElement(cgl.canvas);
        bind();
    }

    cgl.pushViewMatrix();

    px = ip(px, percX);
    py = ip(py, percY);

    let degY = (py + 0.5) * 180;

    if (minRotY.get() !== 0 && degY < minRotY.get())
    {
        degY = minRotY.get();
        py = lastPy;
    }
    else if (maxRotY.get() !== 0 && degY > maxRotY.get())
    {
        degY = maxRotY.get();
        py = lastPy;
    }
    else
    {
        lastPy = py;
    }

    const degX = (px) * CGL.RAD2DEG;

    outYDeg.set(degY);
    outXDeg.set(degX);

    circlePosi(eye, py);

    vec3.add(tempEye, eye, vOffset);
    vec3.add(tempCenter, vCenter, vOffset);

    finalEye[0] = ip(finalEye[0], tempEye[0]);
    finalEye[1] = ip(finalEye[1], tempEye[1]);
    finalEye[2] = ip(finalEye[2], tempEye[2]);

    finalCenter[0] = ip(finalCenter[0], tempCenter[0]);
    finalCenter[1] = ip(finalCenter[1], tempCenter[1]);
    finalCenter[2] = ip(finalCenter[2], tempCenter[2]);

    // eyeTargetCoord[0] = finalEye[0];
    // eyeTargetCoord[1] = finalEye[1];
    // eyeTargetCoord[2] = finalEye[2];
    // eyeTargetCoord[3] = finalCenter[0];
    // eyeTargetCoord[4] = finalCenter[1];
    // eyeTargetCoord[5] = finalCenter[2];
    // outCoords.setRef(eyeTargetCoord);

    const empty = vec3.create();

    if (inIdentity.get()) mat4.identity(cgl.vMatrix);

    mat4.lookAt(viewMatrix, finalEye, finalCenter, vUp);
    mat4.rotate(viewMatrix, viewMatrix, px, vUp);

    // finaly multiply current scene viewmatrix
    mat4.multiply(cgl.vMatrix, cgl.vMatrix, viewMatrix);

    trigger.trigger();
    cgl.popViewMatrix();
    initializing = false;
};

function circlePosi(vec, perc)
{
    if (radius < minDist.get()) radius = minDist.get();
    if (radius > maxDist.get()) radius = maxDist.get();

    outRadius.set(radius);

    let i = 0, degInRad = 0;

    degInRad = 360 * perc / 2 * CGL.DEG2RAD;
    vec3.set(vec,
        Math.cos(degInRad) * radius,
        Math.sin(degInRad) * radius,
        0);
    return vec;
}

function circlePos(perc)
{
    if (radius < minDist.get())radius = minDist.get();
    if (radius > maxDist.get())radius = maxDist.get();

    outRadius.set(radius);

    let i = 0, degInRad = 0;
    const vec = vec3.create();
    degInRad = 360 * perc / 2 * CGL.DEG2RAD;
    vec3.set(vec,
        Math.cos(degInRad) * radius,
        Math.sin(degInRad) * radius,
        0);
    return vec;
}

function onmousemove(event)
{
    if (!mouseDown) return;

    const x = event.clientX;
    const y = event.clientY;

    let movementX = (x - lastMouseX);
    let movementY = (y - lastMouseY);

    movementX *= speedX.get();
    movementY *= speedY.get();

    if (event.buttons == 2 && allowPanning.get())
    {
        vOffset[2] += movementX * 0.01;
        vOffset[1] += movementY * 0.01;
    }
    else
    if (event.buttons == 4 && allowZooming.get())
    {
        radius += movementY * 0.05;
        eye = circlePos(percY);
    }
    else
    {
        if (allowRotation.get())
        {
            percX += movementX * 0.003;
            percY += movementY * 0.002;

            if (restricted.get())
            {
                if (percY > 0.5)percY = 0.5;
                if (percY < -0.5)percY = -0.5;
            }
        }
    }

    lastMouseX = x;
    lastMouseY = y;
}

function onMouseDown(event)
{
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    mouseDown = true;

    try { element.setPointerCapture(event.pointerId); }
    catch (e) {}
}

function onMouseUp(e)
{
    mouseDown = false;

    try { element.releasePointerCapture(e.pointerId); }
    catch (e) {}
}

function lockChange()
{
    const el = op.patch.cg.canvas;

    if (document.pointerLockElement === el || document.mozPointerLockElement === el || document.webkitPointerLockElement === el)
        document.addEventListener("mousemove", onmousemove, false);
}

function onMouseEnter(e)
{
}

initialX.onChange = function ()
{
    px = percX = (initialX.get() * Math.PI * 2);
};

initialAxis.onChange = function ()
{
    py = percY = (initialAxis.get() - 0.5);
    eye = circlePos(percY);
};

const onMouseWheel = function (event)
{
    if (allowZooming.get())
    {
        const delta = CGL.getWheelSpeed(event) * 0.06;
        radius += (parseFloat(delta)) * 1.2;
        eye = circlePos(percY);
    }
};

const ontouchstart = function (event)
{
    if (event.touches && event.touches.length > 0) onMouseDown(event.touches[0]);
};

const ontouchend = function (event)
{
    onMouseUp();
};

const ontouchmove = function (event)
{
    if (event.touches && event.touches.length > 0) onmousemove(event.touches[0]);
};

active.onChange = function ()
{
    if (active.get())bind();
    else unbind();
};

function setElement(ele)
{
    unbind();
    element = ele;
    bind();
}

function bind()
{
    if (!element) return;
    if (!active.get()) return unbind();

    element.addEventListener("pointermove", onmousemove);
    element.addEventListener("pointerdown", onMouseDown);
    element.addEventListener("pointerup", onMouseUp);
    element.addEventListener("pointerleave", onMouseUp);
    element.addEventListener("pointerenter", onMouseEnter);
    element.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    element.addEventListener("wheel", onMouseWheel, { "passive": true });
}

function unbind()
{
    if (!element) return;

    element.removeEventListener("pointermove", onmousemove);
    element.removeEventListener("pointerdown", onMouseDown);
    element.removeEventListener("pointerup", onMouseUp);
    element.removeEventListener("pointerleave", onMouseUp);
    element.removeEventListener("pointerenter", onMouseUp);
    element.removeEventListener("wheel", onMouseWheel);
}

}
};






// **************************************************************
// 
// Ops.Anim.Smooth
// 
// **************************************************************

Ops.Anim.Smooth= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    exec = op.inTrigger("Update"),
    inMode = op.inBool("Separate inc/dec", false),
    inVal = op.inValue("Value"),
    next = op.outTrigger("Next"),
    inDivisorUp = op.inValue("Inc factor", 4),
    inDivisorDown = op.inValue("Dec factor", 4),
    result = op.outNumber("Result", 0);

let val = 0;
let goal = 0;
let oldVal = 0;
let lastTrigger = 0;

op.toWorkPortsNeedToBeLinked(exec);

let divisorUp;
let divisorDown;
let divisor = 4;
let finished = true;

let selectIndex = 0;
const MODE_SINGLE = 0;
const MODE_UP_DOWN = 1;

onFilterChange();
getDivisors();

inMode.setUiAttribs({ "hidePort": true });

inDivisorUp.onChange = inDivisorDown.onChange = getDivisors;
inMode.onChange = onFilterChange;
update();

function onFilterChange()
{
    const selectedMode = inMode.get();
    if (!selectedMode) selectIndex = MODE_SINGLE;
    else selectIndex = MODE_UP_DOWN;

    if (selectIndex == MODE_SINGLE)
    {
        inDivisorDown.setUiAttribs({ "greyout": true });
        inDivisorUp.setUiAttribs({ "title": "Inc/Dec factor" });
    }
    else if (selectIndex == MODE_UP_DOWN)
    {
        inDivisorDown.setUiAttribs({ "greyout": false });
        inDivisorUp.setUiAttribs({ "title": "Inc factor" });
    }

    getDivisors();
    update();
}

function getDivisors()
{
    if (selectIndex == MODE_SINGLE)
    {
        divisorUp = inDivisorUp.get();
        divisorDown = inDivisorUp.get();
    }
    else if (selectIndex == MODE_UP_DOWN)
    {
        divisorUp = inDivisorUp.get();
        divisorDown = inDivisorDown.get();
    }

    if (divisorUp <= 0.2 || divisorUp != divisorUp)divisorUp = 0.2;
    if (divisorDown <= 0.2 || divisorDown != divisorDown)divisorDown = 0.2;
}

inVal.onChange = function ()
{
    finished = false;
    let oldGoal = goal;

    goal = inVal.get();
};

inDivisorUp.onChange = function ()
{
    getDivisors();
};

function update()
{
    let tm = 1;
    if (performance.now() - lastTrigger > 500 || lastTrigger === 0) val = inVal.get() || 0;
    else tm = (performance.now() - lastTrigger) / (performance.now() - lastTrigger);
    lastTrigger = performance.now();

    if (val != val)val = 0;

    if (divisor <= 0)divisor = 0.0001;

    const diff = goal - val;

    if (diff >= 0) val += (diff) / (divisorDown * tm);
    else val += (diff) / (divisorUp * tm);

    if (Math.abs(diff) < 0.00001)val = goal;

    if (divisor != divisor)val = 0;
    if (val != val || val == -Infinity || val == Infinity)val = inVal.get();

    if (oldVal != val)
    {
        result.set(val);
        oldVal = val;
    }

    if (val == goal && !finished)
    {
        finished = true;
        result.set(val);
    }
}

exec.onTriggered = function ()
{
    update();
    next.trigger();
};

}
};






// **************************************************************
// 
// Ops.Ui.VizNumber
// 
// **************************************************************

Ops.Ui.VizNumber= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const inNum = op.inFloat("Number", 0);
const outNum = op.outNumber("Result");

op.setUiAttrib({ "widthOnlyGrow": true });

inNum.onChange = update;

update();

function update()
{
    let n = inNum.get();
    // if (op.patch.isEditorMode())
    // {
    //     let str = "";
    //     if (n === null)str = "null";
    //     else if (isNaN(n))str = "NaN";
    //     else if (n === undefined)str = "undefined";
    //     else
    //     {
    //         str = "" + Math.round(n * 10000) / 10000;

    //         if (str[0] != "-")str = " " + str;
    //     }

    //     op.setUiAttribs({ "extendTitle": str });
    // }
    op.setUiAttribs({ "extendTitle": inNum.getValueForDisplay() });

    outNum.set(n);
}

}
};






// **************************************************************
// 
// Ops.Trigger.Repeat_v2
// 
// **************************************************************

Ops.Trigger.Repeat_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    exe = op.inTrigger("Execute"),
    num = op.inValueInt("Repeats", 5),
    dir = op.inSwitch("Direction", ["Forward", "Backward"], "Forward"),
    next = op.outTrigger("Next"),
    idx = op.addOutPort(new CABLES.Port(op, "index"));

dir.onChange = updateDir;
updateDir();

function updateDir()
{
    if (dir.get() == "Forward") exe.onTriggered = forward;
    else exe.onTriggered = backward;
}

function forward()
{
    const max = Math.floor(num.get());

    for (let i = 0; i < max; i++)
    {
        idx.set(i);
        next.trigger();
    }
}

function backward()
{
    const numi = Math.floor(num.get());
    for (let i = numi - 1; i > -1; i--)
    {
        idx.set(i);
        next.trigger();
    }
}

}
};






// **************************************************************
// 
// Ops.Graphics.Transform
// 
// **************************************************************

Ops.Graphics.Transform= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("render"),
    posX = op.inValue("posX", 0),
    posY = op.inValue("posY", 0),
    posZ = op.inValue("posZ", 0),
    scale = op.inValue("scale", 1),
    rotX = op.inValue("rotX", 0),
    rotY = op.inValue("rotY", 0),
    rotZ = op.inValue("rotZ", 0),
    trigger = op.outTrigger("trigger");

op.setPortGroup("Rotation", [rotX, rotY, rotZ]);
op.setPortGroup("Position", [posX, posY, posZ]);
op.setPortGroup("Scale", [scale]);
op.setUiAxisPorts(posX, posY, posZ);

op.toWorkPortsNeedToBeLinked(render, trigger);

const vPos = vec3.create();
const vScale = vec3.create();
const transMatrix = mat4.create();
mat4.identity(transMatrix);

let
    doScale = false,
    doTranslate = false,
    translationChanged = true,
    scaleChanged = true,
    rotChanged = true;

rotX.onChange = rotY.onChange = rotZ.onChange = setRotChanged;
posX.onChange = posY.onChange = posZ.onChange = setTranslateChanged;
scale.onChange = setScaleChanged;

render.onTriggered = function ()
{
    // if(!CGL.TextureEffect.checkOpNotInTextureEffect(op)) return;

    let updateMatrix = false;
    if (translationChanged)
    {
        updateTranslation();
        updateMatrix = true;
    }
    if (scaleChanged)
    {
        updateScale();
        updateMatrix = true;
    }
    if (rotChanged) updateMatrix = true;

    if (updateMatrix) doUpdateMatrix();

    const cg = op.patch.cg || op.patch.cgl;
    cg.pushModelMatrix();
    mat4.multiply(cg.mMatrix, cg.mMatrix, transMatrix);

    trigger.trigger();
    cg.popModelMatrix();

    if (CABLES.UI)
    {
        if (!posX.isLinked() && !posY.isLinked() && !posZ.isLinked())
        {
            gui.setTransform(op.id, posX.get(), posY.get(), posZ.get());

            if (op.isCurrentUiOp())
                gui.setTransformGizmo(
                    {
                        "posX": posX,
                        "posY": posY,
                        "posZ": posZ,
                    });
        }
    }
};

// op.transform3d = function ()
// {
//     return { "pos": [posX, posY, posZ] };
// };

function doUpdateMatrix()
{
    mat4.identity(transMatrix);
    if (doTranslate)mat4.translate(transMatrix, transMatrix, vPos);

    if (rotX.get() !== 0)mat4.rotateX(transMatrix, transMatrix, rotX.get() * CGL.DEG2RAD);
    if (rotY.get() !== 0)mat4.rotateY(transMatrix, transMatrix, rotY.get() * CGL.DEG2RAD);
    if (rotZ.get() !== 0)mat4.rotateZ(transMatrix, transMatrix, rotZ.get() * CGL.DEG2RAD);

    if (doScale)mat4.scale(transMatrix, transMatrix, vScale);
    rotChanged = false;
}

function updateTranslation()
{
    doTranslate = false;
    if (posX.get() !== 0.0 || posY.get() !== 0.0 || posZ.get() !== 0.0) doTranslate = true;
    vec3.set(vPos, posX.get(), posY.get(), posZ.get());
    translationChanged = false;
}

function updateScale()
{
    doScale = true;
    vec3.set(vScale, scale.get(), scale.get(), scale.get());
    scaleChanged = false;
}

function setTranslateChanged()
{
    translationChanged = true;
}

function setScaleChanged()
{
    scaleChanged = true;
}

function setRotChanged()
{
    rotChanged = true;
}

doUpdateMatrix();

}
};






// **************************************************************
// 
// Ops.Gl.Shader.MatCapMaterial_v3
// 
// **************************************************************

Ops.Gl.Shader.MatCapMaterial_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={"matcap_frag":"{{MODULES_HEAD}}\n\n#ifdef HAS_TEXTURES\n    IN vec2 texCoord;\n#endif\n\nIN vec3 transformedNormal;\nIN vec3 viewSpacePosition;\n\nUNI vec4 inColor;\n\nUNI sampler2D texMatcap;\n\n#ifdef HAS_DIFFUSE_TEXTURE\n   UNI sampler2D texDiffuse;\n#endif\n\n#ifdef USE_SPECULAR_TEXTURE\n   UNI sampler2D texSpec;\n   UNI sampler2D texSpecMatCap;\n#endif\n\n#ifdef HAS_AO_TEXTURE\n    UNI sampler2D texAo;\n    UNI float aoIntensity;\n#endif\n\n#ifdef HAS_NORMAL_TEXTURE\n    IN vec3 vBiTangent;\n    IN vec3 vTangent;\n    IN mat3 normalMatrix;\n\n    UNI sampler2D texNormal;\n    UNI float normalMapIntensity;\n#endif\n\n#ifdef HAS_TEXTURE_OPACITY\n    UNI sampler2D texOpacity;\n#endif\n\n#ifdef CALC_SSNORMALS\n    IN vec3 eye_relative_pos;\n\n    // from https://www.enkisoftware.com/devlogpost-20150131-1-Normal_generation_in_the_pixel_shader\n    vec3 CalculateScreenSpaceNormals() {\n    \tvec3 dFdxPos = dFdx(eye_relative_pos);\n    \tvec3 dFdyPos = dFdy(eye_relative_pos);\n    \tvec3 screenSpaceNormal = normalize( cross(dFdxPos, dFdyPos));\n        return normalize(screenSpaceNormal);\n    }\n#endif\n\n// * taken & modified from https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/meshmatcap_frag.glsl.js\nvec2 getMatCapUV(vec3 viewSpacePosition, vec3 normal) {\n    vec3 viewDir = normalize(-viewSpacePosition);\n\tvec3 x = normalize(vec3(viewDir.z, 0.0, - viewDir.x));\n\tvec3 y = normalize(cross(viewDir, x));\n\tvec2 uv = vec2(dot(x, normal), dot(y, normal)) * 0.495 + 0.5; // 0.495 to remove artifacts caused by undersized matcap disks\n\treturn uv;\n}\n\nvoid main()\n{\n    vec3 normal = normalize(transformedNormal);\n    {{MODULE_NORMAL}}\n\n\n\n    #ifdef HAS_TEXTURES\n        vec2 texCoords = texCoord;\n        {{MODULE_BEGIN_FRAG}}\n    #endif\n\n\n\n    #ifdef DOUBLE_SIDED\n        if(!gl_FrontFacing) normal *= -1.0;\n    #endif\n\n    #ifdef CALC_SSNORMALS\n        normal = CalculateScreenSpaceNormals();\n    #endif\n\n\n\n   #ifdef HAS_NORMAL_TEXTURE\n        vec3 normalFromMap = texture( texNormal, texCoord ).xyz * 2.0 - 1.0;\n        normalFromMap = normalize(normalFromMap);\n\n        vec3 tangent;\n        vec3 binormal;\n\n        #ifdef CALC_TANGENT\n            vec3 c1 = cross(normalFromMap, vec3(0.0, 0.0, 1.0));\n            vec3 c2 = cross(normalFromMap, vec3(0.0, 1.0, 0.0));\n\n            tangent = c1;\n            tangent = normalize(tangent);\n            binormal = cross(normal, tangent);\n            binormal = normalize(binormal);\n        #endif\n\n        #ifndef CALC_TANGENT\n            tangent = normalize(normalMatrix * vTangent);\n            vec3 bitangent = normalize(normalMatrix * vBiTangent);\n            binormal = normalize(cross(normal, bitangent));\n        #endif\n\n        normalFromMap = normalize(\n            tangent * normalFromMap.x\n            + binormal * normalFromMap.y\n            + normal * normalFromMap.z\n        );\n\n        vec3 mixedNormal = normalize(normal + normalFromMap * normalMapIntensity);\n\n        normal = mixedNormal;\n    #endif\n\n    vec4 col = texture(texMatcap, getMatCapUV(viewSpacePosition, normal));\n\n    #ifdef HAS_DIFFUSE_TEXTURE\n        col = col*texture(texDiffuse, texCoords);\n    #endif\n\n    col.rgb *= inColor.rgb;\n\n\n    #ifdef HAS_AO_TEXTURE\n        col = col\n            * mix(\n                vec4(1.0,1.0,1.0,1.0),\n                texture(texAo, texCoords),\n                aoIntensity\n            );\n    #endif\n\n    #ifdef USE_SPECULAR_TEXTURE\n        vec4 spec = texture(texSpecMatCap, getMatCapUV(viewSpacePosition, normal));\n        spec *= texture(texSpec, texCoords);\n        col += spec;\n    #endif\n\n    col.a *= inColor.a;\n\n    #ifdef HAS_TEXTURE_OPACITY\n        #ifdef TRANSFORMALPHATEXCOORDS\n            texCoords=vec2(texCoord.s,1.0-texCoord.t);\n            texCoords.y = 1. - texCoords.y;\n        #endif\n        #ifdef ALPHA_MASK_ALPHA\n            col.a*=texture(texOpacity,texCoords).a;\n        #endif\n        #ifdef ALPHA_MASK_LUMI\n            col.a*=dot(vec3(0.2126,0.7152,0.0722), texture(texOpacity,texCoords).rgb);\n        #endif\n        #ifdef ALPHA_MASK_R\n            col.a*=texture(texOpacity,texCoords).r;\n        #endif\n        #ifdef ALPHA_MASK_G\n            col.a*=texture(texOpacity,texCoords).g;\n        #endif\n        #ifdef ALPHA_MASK_B\n            col.a*=texture(texOpacity,texCoords).b;\n        #endif\n\n        #ifdef DISCARDTRANS\n            if(col.a < 0.2) discard;\n        #endif\n    #endif\n\n    {{MODULE_COLOR}}\n\n    outColor = col;\n}","matcap_vert":"IN vec3 vPosition;\n\n#ifdef HAS_TEXTURES\n    IN vec2 attrTexCoord;\n#endif\n\nIN vec3 attrVertNormal;\nIN float attrVertIndex;\n\n#ifdef HAS_NORMAL_TEXTURE\n    IN vec3 attrTangent;\n    IN vec3 attrBiTangent;\n    OUT vec3 vBiTangent;\n    OUT vec3 vTangent;\n#endif\n\nUNI mat4 projMatrix;\nUNI mat4 modelMatrix;\nUNI mat4 viewMatrix;\nUNI vec3 camPos;\n\n#ifdef HAS_TEXTURES\n    UNI vec2 texOffset;\n    UNI vec2 texRepeat;\n    OUT vec2 texCoord;\n#endif\n\nOUT mat3 normalMatrix;\nOUT vec3 viewSpacePosition;\nOUT vec3 transformedNormal;\n\n{{MODULES_HEAD}}\n\n#ifdef CALC_SSNORMALS\n    // from https://www.enkisoftware.com/devlogpost-20150131-1-Normal_generation_in_the_pixel_shader\n    OUT vec3 eye_relative_pos;\n#endif\n\nmat3 transposeMat3(mat3 m) {\n    return mat3(m[0][0], m[1][0], m[2][0],\n        m[0][1], m[1][1], m[2][1],\n        m[0][2], m[1][2], m[2][2]);\n}\n\n mat3 inverseMat3(mat3 m) {\n    float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];\n    float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];\n    float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];\n\n    float b01 = a22 * a11 - a12 * a21;\n    float b11 = -a22 * a10 + a12 * a20;\n    float b21 = a21 * a10 - a11 * a20;\n\n    float det = a00 * b01 + a01 * b11 + a02 * b21;\n\n    return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),\n        b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),\n        b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;\n}\n\nvoid main()\n{\n    #ifdef HAS_TEXTURES\n        texCoord = texRepeat * vec2(attrTexCoord.x, attrTexCoord.y) + texOffset;\n        texCoord.y = 1. - texCoord.y;\n    #endif\n\n    mat4 mMatrix = modelMatrix;\n    mat4 mvMatrix;\n\n    #ifdef HAS_NORMAL_TEXTURE\n        vec3 tangent = attrTangent;\n        vec3 bitangent = attrBiTangent;\n        vTangent = attrTangent;\n        vBiTangent = attrBiTangent;\n    #endif\n\n    vec4 pos = vec4(vPosition, 1.);\n    vec3 norm = attrVertNormal;\n\n    {{MODULE_VERTEX_POSITION}}\n\n    mvMatrix = viewMatrix * mMatrix;\n    vec3 normal = norm;\n\n    normalMatrix = transposeMat3(inverseMat3(mat3(mvMatrix)));\n\n    vec3 fragPos = vec3((mvMatrix) * pos);\n    viewSpacePosition = normalize(fragPos);\n\n    #ifdef CALC_SSNORMALS\n        eye_relative_pos = -(vec3(viewMatrix * vec4(camPos, 1.)) - fragPos);\n    #endif\n\n    transformedNormal = normalize(mat3(normalMatrix) * normal);\n\n    mat4 modelViewMatrix=mvMatrix;\n    {{MODULE_VERTEX_MODELVIEW}}\n\n    gl_Position = projMatrix * modelViewMatrix * pos;\n\n}\n",};
const cgl = op.patch.cgl;

const
    render = op.inTrigger("Render"),
    textureMatcap = op.inTexture("MatCap"),
    textureDiffuse = op.inTexture("Diffuse"),
    textureNormal = op.inTexture("Normal"),
    textureSpec = op.inTexture("Specular Mask"),
    textureSpecMatCap = op.inTexture("Specular MatCap"),
    textureAo = op.inTexture("AO Texture"),
    textureOpacity = op.inTexture("Opacity Texture"),
    r = op.inValueSlider("r", 1),
    g = op.inValueSlider("g", 1),
    b = op.inValueSlider("b", 1),
    pOpacity = op.inValueSlider("Opacity", 1),
    aoIntensity = op.inValueSlider("AO Intensity", 1.0),
    normalMapIntensity = op.inFloatSlider("Normal Map Intensity", 1),
    repeatX = op.inValue("Repeat X", 1),
    repeatY = op.inValue("Repeat Y", 1),
    offsetX = op.inValue("Offset X", 0),
    offsetY = op.inValue("Offset Y", 0),
    inDoubleSided = op.inValueBool("Double Sided"),
    ssNormals = op.inValueBool("Screen Space Normals"),
    calcTangents = op.inValueBool("Calc normal tangents", true),
    texCoordAlpha = op.inValueBool("Opacity TexCoords Transform", false),
    discardTransPxl = op.inValueBool("Discard Transparent Pixels"),

    next = op.outTrigger("Next"),
    shaderOut = op.outObject("Shader");

r.setUiAttribs({ "colorPick": true });

const alphaMaskSource = op.inSwitch("Alpha Mask Source", ["Luminance", "R", "G", "B", "A"], "Luminance");
alphaMaskSource.setUiAttribs({ "greyout": true });

op.setPortGroup("Normals", [calcTangents, ssNormals, inDoubleSided]);
op.setPortGroup("Texture Opacity", [alphaMaskSource, texCoordAlpha, discardTransPxl]);
op.setPortGroup("Texture Transforms", [aoIntensity, normalMapIntensity, repeatX, repeatY, offsetX, offsetY]);
op.setPortGroup("Texture Maps", [textureDiffuse, textureNormal, textureSpec, textureSpecMatCap, textureAo, textureOpacity]);
op.setPortGroup("Color", [r, g, b, pOpacity]);

const shader = new CGL.Shader(cgl, "MatCapMaterialNew3");
const uniOpacity = new CGL.Uniform(shader, "f", "opacity", pOpacity);

shader.setModules(["MODULE_VERTEX_POSITION", "MODULE_COLOR", "MODULE_NORMAL", "MODULE_BEGIN_FRAG", "MODULE_VERTEX_MODELVIEW"]);
shader.setSource(attachments.matcap_vert, attachments.matcap_frag);
shaderOut.setRef(shader);

const textureMatcapUniform = new CGL.Uniform(shader, "t", "texMatcap");
let textureDiffuseUniform = null;
let textureNormalUniform = null;
let normalMapIntensityUniform = null;
let textureSpecUniform = null;
let textureSpecMatCapUniform = null;
let textureAoUniform = null;
const offsetUniform = new CGL.Uniform(shader, "2f", "texOffset", offsetX, offsetY);
const repeatUniform = new CGL.Uniform(shader, "2f", "texRepeat", repeatX, repeatY);

const aoIntensityUniform = new CGL.Uniform(shader, "f", "aoIntensity", aoIntensity);
const colorUniform = new CGL.Uniform(shader, "4f", "inColor", r, g, b, pOpacity);

inDoubleSided.onChange =
calcTangents.onChange = updateDefines;
updateDefines();

function updateDefines()
{
    shader.toggleDefine("DOUBLE_SIDED", inDoubleSided.get());

    if (calcTangents.get()) shader.define("CALC_TANGENT");
    else shader.removeDefine("CALC_TANGENT");
}

ssNormals.onChange = function ()
{
    if (ssNormals.get())
    {
        if (cgl.glVersion < 2)
        {
            cgl.gl.getExtension("OES_standard_derivatives");
            shader.enableExtension("GL_OES_standard_derivatives");
        }

        shader.define("CALC_SSNORMALS");
    }
    else shader.removeDefine("CALC_SSNORMALS");
};

textureMatcap.onChange = updateMatcap;

function updateMatcap()
{
    if (!cgl.defaultMatcapTex3)
    {
        const pixels = new Uint8Array(256 * 4);
        for (let x = 0; x < 16; x++)
        {
            for (let y = 0; y < 16; y++)
            {
                let c = y * 16;
                c *= Math.min(1, (x + y / 3) / 8);
                pixels[(x + y * 16) * 4 + 0] = pixels[(x + y * 16) * 4 + 1] = pixels[(x + y * 16) * 4 + 2] = c;
                pixels[(x + y * 16) * 4 + 3] = 255;
            }
        }

        cgl.defaultMatcapTex3 = new CGL.Texture(cgl);
        cgl.defaultMatcapTex3.initFromData(pixels, 16, 16, CGL.Texture.FILTER_LINEAR, CGL.Texture.WRAP_REPEAT);
    }
}

textureDiffuse.onChange = function ()
{
    if (textureDiffuse.get())
    {
        if (textureDiffuseUniform !== null) return;
        shader.define("HAS_DIFFUSE_TEXTURE");
        shader.removeUniform("texDiffuse");
        textureDiffuseUniform = new CGL.Uniform(shader, "t", "texDiffuse");
    }
    else
    {
        shader.removeDefine("HAS_DIFFUSE_TEXTURE");
        shader.removeUniform("texDiffuse");
        textureDiffuseUniform = null;
    }
};

textureNormal.onChange = function ()
{
    if (textureNormal.get())
    {
        if (textureNormalUniform !== null) return;
        shader.define("HAS_NORMAL_TEXTURE");
        shader.removeUniform("texNormal");
        textureNormalUniform = new CGL.Uniform(shader, "t", "texNormal");
        if (!normalMapIntensityUniform) normalMapIntensityUniform = new CGL.Uniform(shader, "f", "normalMapIntensity", normalMapIntensity);
    }
    else
    {
        shader.removeDefine("HAS_NORMAL_TEXTURE");
        shader.removeUniform("texNormal");
        textureNormalUniform = null;
    }
};

textureAo.onChange = function ()
{
    if (textureAo.get())
    {
        if (textureAoUniform !== null) return;
        shader.define("HAS_AO_TEXTURE");
        shader.removeUniform("texAo");
        textureAoUniform = new CGL.Uniform(shader, "t", "texAo");
    }
    else
    {
        shader.removeDefine("HAS_AO_TEXTURE");
        shader.removeUniform("texAo");
        textureAoUniform = null;
    }
};

textureSpec.onChange = textureSpecMatCap.onChange = function ()
{
    if (textureSpec.get() && textureSpecMatCap.get())
    {
        if (textureSpecUniform !== null) return;
        shader.define("USE_SPECULAR_TEXTURE");
        shader.removeUniform("texSpec");
        shader.removeUniform("texSpecMatCap");
        textureSpecUniform = new CGL.Uniform(shader, "t", "texSpec");
        textureSpecMatCapUniform = new CGL.Uniform(shader, "t", "texSpecMatCap");
    }
    else
    {
        shader.removeDefine("USE_SPECULAR_TEXTURE");
        shader.removeUniform("texSpec");
        shader.removeUniform("texSpecMatCap");
        textureSpecUniform = null;
        textureSpecMatCapUniform = null;
    }
};

// TEX OPACITY

function updateAlphaMaskMethod()
{
    if (alphaMaskSource.get() == "Alpha Channel") shader.define("ALPHA_MASK_ALPHA");
    else shader.removeDefine("ALPHA_MASK_ALPHA");

    if (alphaMaskSource.get() == "Luminance") shader.define("ALPHA_MASK_LUMI");
    else shader.removeDefine("ALPHA_MASK_LUMI");

    if (alphaMaskSource.get() == "R") shader.define("ALPHA_MASK_R");
    else shader.removeDefine("ALPHA_MASK_R");

    if (alphaMaskSource.get() == "G") shader.define("ALPHA_MASK_G");
    else shader.removeDefine("ALPHA_MASK_G");

    if (alphaMaskSource.get() == "B") shader.define("ALPHA_MASK_B");
    else shader.removeDefine("ALPHA_MASK_B");
}

alphaMaskSource.onChange = updateAlphaMaskMethod;
textureOpacity.onChange = updateOpacity;

let textureOpacityUniform = null;

function updateOpacity()
{
    if (textureOpacity.get())
    {
        if (textureOpacityUniform !== null) return;
        shader.removeUniform("texOpacity");
        shader.define("HAS_TEXTURE_OPACITY");
        if (!textureOpacityUniform) textureOpacityUniform = new CGL.Uniform(shader, "t", "texOpacity");

        alphaMaskSource.setUiAttribs({ "greyout": false });
        discardTransPxl.setUiAttribs({ "greyout": false });
        texCoordAlpha.setUiAttribs({ "greyout": false });
    }
    else
    {
        shader.removeUniform("texOpacity");
        shader.removeDefine("HAS_TEXTURE_OPACITY");
        textureOpacityUniform = null;

        alphaMaskSource.setUiAttribs({ "greyout": true });
        discardTransPxl.setUiAttribs({ "greyout": true });
        texCoordAlpha.setUiAttribs({ "greyout": true });
    }
    updateAlphaMaskMethod();
}

discardTransPxl.onChange = function ()
{
    if (discardTransPxl.get()) shader.define("DISCARDTRANS");
    else shader.removeDefine("DISCARDTRANS");
};

texCoordAlpha.onChange = function ()
{
    if (texCoordAlpha.get()) shader.define("TRANSFORMALPHATEXCOORDS");
    else shader.removeDefine("TRANSFORMALPHATEXCOORDS");
};

function checkUiErrors()
{
    if (textureSpec.get() && !textureSpecMatCap.get())
    {
        op.setUiError("specNoMatCapSpec", "You connected a specular texture but have not connected a specular matcap texture. You need to connect both texture inputs for the specular input to work.", 1);
        op.setUiError("noSpecMatCapSpec", null);
    }
    else if (!textureSpec.get() && textureSpecMatCap.get())
    {
        op.setUiError("noSpecMatCapSpec", "You connected a specular matcap texture but have not connected a specular texture. You need to connect both texture inputs for the specular input to work.", 1);
        op.setUiError("specNoMatCapSpec", null);
    }
    else if (textureSpec.get() && textureSpecMatCap.get())
    {
        op.setUiError("specNoMatCapSpec", null);
        op.setUiError("noSpecMatCapSpec", null);
    }
    else
    {
        op.setUiError("specNoMatCapSpec", null);
        op.setUiError("noSpecMatCapSpec", null);
    }
}

render.onTriggered = function ()
{
    checkUiErrors();
    op.checkGraphicsApi();

    if (!cgl.defaultMatcapTex3) updateMatcap();
    shader.popTextures();

    const tex = textureMatcap.get() || cgl.defaultMatcapTex3;
    shader.pushTexture(textureMatcapUniform, tex.tex);

    if (textureDiffuse.get() && textureDiffuseUniform) shader.pushTexture(textureDiffuseUniform, textureDiffuse.get().tex);
    if (textureNormal.get() && textureNormalUniform) shader.pushTexture(textureNormalUniform, textureNormal.get().tex);
    if (textureSpec.get() && textureSpecUniform) shader.pushTexture(textureSpecUniform, textureSpec.get().tex);
    if (textureSpecMatCap.get() && textureSpecMatCapUniform) shader.pushTexture(textureSpecMatCapUniform, textureSpecMatCap.get().tex);
    if (textureAo.get() && textureAoUniform) shader.pushTexture(textureAoUniform, textureAo.get().tex);
    if (textureOpacity.get() && textureOpacityUniform) shader.pushTexture(textureOpacityUniform, textureOpacity.get().tex);

    cgl.pushShader(shader);
    next.trigger();
    cgl.popShader();
};

}
};






// **************************************************************
// 
// Ops.Graphics.Meshes.Cube_v2
// 
// **************************************************************

Ops.Graphics.Meshes.Cube_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("Render"),
    inDraw = op.inValueBool("Render Mesh", true),
    width = op.inValue("Width", 1),
    len = op.inValue("Length", 1),
    height = op.inValue("Height", 1),
    center = op.inValueBool("Center", true),
    mapping = op.inSwitch("Mapping", ["Side", "Cube +-", "SideWrap"], "Side"),
    mappingBias = op.inValue("Bias", 0),
    inFlipX = op.inValueBool("Flip X", true),
    sideTop = op.inValueBool("Top", true),
    sideBottom = op.inValueBool("Bottom", true),
    sideLeft = op.inValueBool("Left", true),
    sideRight = op.inValueBool("Right", true),
    sideFront = op.inValueBool("Front", true),
    sideBack = op.inValueBool("Back", true),
    trigger = op.outTrigger("Next"),
    geomOut = op.outObject("geometry", null, "geometry");

const cgl = op.patch.cgl;
op.toWorkPortsNeedToBeLinked(render);
op.toWorkShouldNotBeChild("Ops.Gl.TextureEffects.ImageCompose", CABLES.OP_PORT_TYPE_FUNCTION);

op.setPortGroup("Mapping", [mapping, mappingBias, inFlipX]);
op.setPortGroup("Geometry", [width, height, len, center]);
op.setPortGroup("Sides", [sideTop, sideBottom, sideLeft, sideRight, sideFront, sideBack]);

inDraw.onChange = () => { op.setUiAttrib({ "extendTitle": inDraw.get() ? "" : "x" }); };

let geom = null,
    mesh = null,
    meshvalid = true,
    needsRebuild = true;

mappingBias.onChange =
    inFlipX.onChange =
    sideTop.onChange =
    sideBottom.onChange =
    sideLeft.onChange =
    sideRight.onChange =
    sideFront.onChange =
    sideBack.onChange =
    mapping.onChange =
    width.onChange =
    height.onChange =
    len.onChange =
    center.onChange = buildMeshLater;

function buildMeshLater()
{
    needsRebuild = true;
}

render.onLinkChanged = function ()
{
    if (!render.isLinked()) geomOut.set(null);
    else geomOut.setRef(geom);
};

render.onTriggered = function ()
{
    if (needsRebuild)buildMesh();
    if (inDraw.get() && mesh && meshvalid) mesh.render();
    trigger.trigger();
};

op.preRender = function ()
{
    buildMesh();
    if (mesh && cgl)mesh.render();
};

function buildMesh()
{
    if (!geom)geom = new CGL.Geometry("cubemesh");
    geom.clear();

    let x = width.get();
    let nx = -1 * width.get();
    let y = height.get();
    let ny = -1 * height.get();
    let z = len.get();
    let nz = -1 * len.get();

    if (!center.get())
    {
        nx = 0;
        ny = 0;
        nz = 0;
    }
    else
    {
        x *= 0.5;
        nx *= 0.5;
        y *= 0.5;
        ny *= 0.5;
        z *= 0.5;
        nz *= 0.5;
    }

    addAttribs(geom, x, y, z, nx, ny, nz);
    if (mapping.get() == "Side") sideMappedCube(geom, 1, 1, 1);
    else if (mapping.get() == "SideWrap") sideMappedCube(geom, x, y, z);
    else cubeMappedCube(geom);

    geom.verticesIndices = [];
    if (sideTop.get()) geom.verticesIndices.push(8, 9, 10, 8, 10, 11); // Top face
    if (sideBottom.get()) geom.verticesIndices.push(12, 13, 14, 12, 14, 15); // Bottom face
    if (sideLeft.get()) geom.verticesIndices.push(20, 21, 22, 20, 22, 23); // Left face
    if (sideRight.get()) geom.verticesIndices.push(16, 17, 18, 16, 18, 19); // Right face
    if (sideBack.get()) geom.verticesIndices.push(4, 5, 6, 4, 6, 7); // Back face
    if (sideFront.get()) geom.verticesIndices.push(0, 1, 2, 0, 2, 3); // Front face

    if (geom.verticesIndices.length === 0) meshvalid = false;
    else meshvalid = true;

    if (mesh)mesh.dispose();
    if (op.patch.cg) mesh = op.patch.cg.createMesh(geom, { "opId": op.id });

    geomOut.setRef(geom);

    needsRebuild = false;
}

op.onDelete = function ()
{
    if (mesh)mesh.dispose();
};

function sideMappedCube(geom, x, y, z)
{
    const bias = mappingBias.get();

    let u1 = 1.0 - bias;
    let u0 = 0.0 + bias;
    if (inFlipX.get())
    {
        [u1, u0] = [u0, u1];
    }

    let v1 = 1.0 - bias;
    let v0 = 0.0 + bias;

    geom.setTexCoords([
        // Front face
        x * u0, y * v1,
        x * u1, y * v1,
        x * u1, y * v0,
        x * u0, y * v0,
        // Back face
        x * u1, y * v1,
        x * u1, y * v0,
        x * u0, y * v0,
        x * u0, y * v1,
        // Top face
        x * u0, z * v0,
        x * u0, z * v1,
        x * u1, z * v1,
        x * u1, z * v0,
        // Bottom face
        x * u1, y * v0,
        x * u0, y * v0,
        x * u0, y * v1,
        x * u1, y * v1,
        // Right face
        z * u1, y * v1,
        z * u1, y * v0,
        z * u0, y * v0,
        z * u0, y * v1,
        // Left face
        z * u0, y * v1,
        z * u1, y * v1,
        z * u1, y * v0,
        z * u0, y * v0,
    ]);
}

function cubeMappedCube(geom, x, y, z, nx, ny, nz)
{
    const sx = 0.25;
    const sy = 1 / 3;
    const bias = mappingBias.get();

    let flipx = 0.0;
    if (inFlipX.get()) flipx = 1.0;

    const tc = [];
    tc.push(
        // Front face   Z+
        flipx + sx + bias, sy * 2 - bias, flipx + sx * 2 - bias, sy * 2 - bias, flipx + sx * 2 - bias, sy + bias, flipx + sx + bias, sy + bias,
        // Back face Z-
        flipx + sx * 4 - bias, sy * 2 - bias, flipx + sx * 4 - bias, sy + bias, flipx + sx * 3 + bias, sy + bias, flipx + sx * 3 + bias, sy * 2 - bias);

    if (inFlipX.get())
        tc.push(
            // Top face
            sx + bias, 0 - bias, sx * 2 - bias, 0 - bias, sx * 2 - bias, sy * 1 + bias, sx + bias, sy * 1 + bias,
            // Bottom face
            sx + bias, sy * 3 + bias, sx + bias, sy * 2 - bias, sx * 2 - bias, sy * 2 - bias, sx * 2 - bias, sy * 3 + bias
        );

    else
        tc.push(
            // Top face
            sx + bias, 0 + bias, sx + bias, sy * 1 - bias, sx * 2 - bias, sy * 1 - bias, sx * 2 - bias, 0 + bias,
            // Bottom face
            sx + bias, sy * 3 - bias, sx * 2 - bias, sy * 3 - bias, sx * 2 - bias, sy * 2 + bias, sx + bias, sy * 2 + bias);

    tc.push(
        // Right face
        flipx + sx * 3 - bias, 1.0 - sy - bias, flipx + sx * 3 - bias, 1.0 - sy * 2 + bias, flipx + sx * 2 + bias, 1.0 - sy * 2 + bias, flipx + sx * 2 + bias, 1.0 - sy - bias,
        // Left face
        flipx + sx * 0 + bias, 1.0 - sy - bias, flipx + sx * 1 - bias, 1.0 - sy - bias, flipx + sx * 1 - bias, 1.0 - sy * 2 + bias, flipx + sx * 0 + bias, 1.0 - sy * 2 + bias);

    geom.setTexCoords(tc);
}

function addAttribs(geom, x, y, z, nx, ny, nz)
{
    geom.vertices = [
        // Front face
        nx, ny, z,
        x, ny, z,
        x, y, z,
        nx, y, z,
        // Back face
        nx, ny, nz,
        nx, y, nz,
        x, y, nz,
        x, ny, nz,
        // Top face
        nx, y, nz,
        nx, y, z,
        x, y, z,
        x, y, nz,
        // Bottom face
        nx, ny, nz,
        x, ny, nz,
        x, ny, z,
        nx, ny, z,
        // Right face
        x, ny, nz,
        x, y, nz,
        x, y, z,
        x, ny, z,
        // zeft face
        nx, ny, nz,
        nx, ny, z,
        nx, y, z,
        nx, y, nz
    ];

    geom.vertexNormals = new Float32Array([
        // Front face
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,

        // Back face
        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,

        // Top face
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,

        // Bottom face
        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,

        // Right face
        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,

        // Left face
        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0
    ]);
    geom.tangents = new Float32Array([
        // front face
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        // back face
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        // top face
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        // bottom face
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        // right face
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        // left face
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1
    ]);
    geom.biTangents = new Float32Array([
        // front face
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        // back face
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        // top face
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        // bottom face
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        // right face
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        // left face
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1
    ]);
}

}
};






// **************************************************************
// 
// Ops.Gl.Texture_v2
// 
// **************************************************************

Ops.Gl.Texture_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    filename = op.inUrl("File", [".jpg", ".png", ".webp", ".jpeg", ".avif"]),
    tfilter = op.inSwitch("Filter", ["nearest", "linear", "mipmap"]),
    wrap = op.inValueSelect("Wrap", ["repeat", "mirrored repeat", "clamp to edge"], "clamp to edge"),
    aniso = op.inSwitch("Anisotropic", ["0", "1", "2", "4", "8", "16"], "0"),
    dataFrmt = op.inSwitch("Data Format", ["R", "RG", "RGB", "RGBA", "SRGBA"], "RGBA"),
    flip = op.inValueBool("Flip", false),
    unpackAlpha = op.inValueBool("Pre Multiplied Alpha", false),
    active = op.inValueBool("Active", true),
    inFreeMemory = op.inBool("Save Memory", true),
    textureOut = op.outTexture("Texture"),
    addCacheBust = op.inBool("Add Cachebuster", false),
    inReload = op.inTriggerButton("Reload"),
    width = op.outNumber("Width"),
    height = op.outNumber("Height"),
    ratio = op.outNumber("Aspect Ratio"),
    loaded = op.outBoolNum("Loaded", 0),
    loading = op.outBoolNum("Loading", 0);

const cgl = op.patch.cgl;

// op.toWorkPortsNeedToBeLinked(textureOut);
op.setPortGroup("Size", [width, height]);

let loadedFilename = null;
let loadingId = null;
let tex = null;
let cgl_filter = CGL.Texture.FILTER_MIPMAP;
let cgl_wrap = CGL.Texture.WRAP_REPEAT;
let cgl_aniso = 0;
let timedLoader = 0;

unpackAlpha.setUiAttribs({ "hidePort": true });
unpackAlpha.onChange =
    filename.onChange =
    dataFrmt.onChange =
    addCacheBust.onChange =
    flip.onChange = reloadSoon;
aniso.onChange = tfilter.onChange = onFilterChange;
wrap.onChange = onWrapChange;

tfilter.set("mipmap");
wrap.set("repeat");

textureOut.setRef(CGL.Texture.getEmptyTexture(cgl));

inReload.onTriggered = reloadSoon;

active.onChange = function ()
{
    if (active.get())
    {
        if (loadedFilename != filename.get() || !tex) reloadSoon();
        else textureOut.setRef(tex);
    }
    else
    {
        textureOut.setRef(CGL.Texture.getEmptyTexture(cgl));
        width.set(CGL.Texture.getEmptyTexture(cgl).width);
        height.set(CGL.Texture.getEmptyTexture(cgl).height);
        if (tex)tex.delete();
        op.setUiAttrib({ "extendTitle": "" });
        tex = null;
    }
};

const setTempTexture = function ()
{
    const t = CGL.Texture.getTempTexture(cgl);
    textureOut.setRef(t);
};

function reloadSoon(nocache)
{
    clearTimeout(timedLoader);
    timedLoader = setTimeout(function ()
    {
        realReload(nocache);
    }, 1);
}

function getPixelFormat()
{
    if (dataFrmt.get() == "R") return CGL.Texture.PFORMATSTR_R8UB;
    if (dataFrmt.get() == "RG") return CGL.Texture.PFORMATSTR_RG8UB;
    if (dataFrmt.get() == "RGB") return CGL.Texture.PFORMATSTR_RGB8UB;
    if (dataFrmt.get() == "SRGBA") return CGL.Texture.PFORMATSTR_SRGBA8;

    return CGL.Texture.PFORMATSTR_RGBA8UB;
}

function realReload(nocache)
{
    op.checkMainloopExists();
    if (!active.get()) return;
    if (loadingId)loadingId = op.patch.loading.finished(loadingId);

    loadingId = op.patch.loading.start(op.objName, filename.get(), op);

    let url = op.patch.getFilePath(String(filename.get()));

    if (addCacheBust.get() || nocache === true) url = CABLES.cacheBust(url);

    if (String(filename.get()).indexOf("data:") == 0) url = filename.get();

    let needsRefresh = false;
    loadedFilename = filename.get();

    if ((filename.get() && filename.get().length > 1))
    {
        loaded.set(false);
        loading.set(true);

        const fileToLoad = filename.get();

        op.setUiAttrib({ "extendTitle": CABLES.basename(url) });
        if (needsRefresh) op.refreshParams();

        op.patch.loading.addAssetLoadingTask(() =>
        {
            op.setUiError("urlerror", null);
            CGL.Texture.load(cgl, url, function (err, newTex)
            {
                if (filename.get() != fileToLoad)
                {
                    loadingId = op.patch.loading.finished(loadingId);
                    return;
                }

                if (tex)tex.delete();

                if (err)
                {
                    const t = CGL.Texture.getErrorTexture(cgl);
                    textureOut.setRef(t);

                    op.setUiError("urlerror", "could not load texture: \"" + filename.get() + "\"", 2);
                    loadingId = op.patch.loading.finished(loadingId);
                    return;
                }

                width.set(newTex.width);
                height.set(newTex.height);
                ratio.set(newTex.width / newTex.height);

                tex = newTex;
                textureOut.setRef(tex);

                loading.set(false);
                loaded.set(true);

                if (inFreeMemory.get()) tex.image = null;

                if (loadingId)
                {
                    loadingId = op.patch.loading.finished(loadingId);
                }
                op.checkMainloopExists();
            }, {
                "anisotropic": cgl_aniso,
                "wrap": cgl_wrap,
                "flip": flip.get(),
                "unpackAlpha": unpackAlpha.get(),
                "pixelFormat": getPixelFormat(),
                "filter": cgl_filter
            });

            op.checkMainloopExists();
        });
    }
    else
    {
        setTempTexture();
        loadingId = op.patch.loading.finished(loadingId);
    }
}

function onFilterChange()
{
    if (tfilter.get() == "nearest") cgl_filter = CGL.Texture.FILTER_NEAREST;
    else if (tfilter.get() == "linear") cgl_filter = CGL.Texture.FILTER_LINEAR;
    else if (tfilter.get() == "mipmap") cgl_filter = CGL.Texture.FILTER_MIPMAP;
    else if (tfilter.get() == "Anisotropic") cgl_filter = CGL.Texture.FILTER_ANISOTROPIC;
    aniso.setUiAttribs({ "greyout": cgl_filter != CGL.Texture.FILTER_MIPMAP });

    cgl_aniso = parseFloat(aniso.get());

    reloadSoon();
}

function onWrapChange()
{
    if (wrap.get() == "repeat") cgl_wrap = CGL.Texture.WRAP_REPEAT;
    if (wrap.get() == "mirrored repeat") cgl_wrap = CGL.Texture.WRAP_MIRRORED_REPEAT;
    if (wrap.get() == "clamp to edge") cgl_wrap = CGL.Texture.WRAP_CLAMP_TO_EDGE;

    reloadSoon();
}

op.onFileChanged = function (fn)
{
    if (filename.get() && filename.get().indexOf(fn) > -1)
    {
        textureOut.setRef(CGL.Texture.getEmptyTexture(op.patch.cgl));
        textureOut.setRef(CGL.Texture.getTempTexture(cgl));
        realReload(true);
    }
};

}
};






// **************************************************************
// 
// Ops.Gl.Shader.BasicMaterial_v3
// 
// **************************************************************

Ops.Gl.Shader.BasicMaterial_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={"basicmaterial_frag":"{{MODULES_HEAD}}\n\nIN vec2 texCoord;\n\n#ifdef VERTEX_COLORS\nIN vec4 vertCol;\n#endif\n\n#ifdef HAS_TEXTURES\n    IN vec2 texCoordOrig;\n    #ifdef HAS_TEXTURE_DIFFUSE\n        UNI sampler2D tex;\n    #endif\n    #ifdef HAS_TEXTURE_OPACITY\n        UNI sampler2D texOpacity;\n   #endif\n#endif\n\n///\n\nvoid main()\n{\n    {{MODULE_BEGIN_FRAG}}\n    vec4 col=color;\n\n\n    #ifdef HAS_TEXTURES\n        vec2 uv=texCoord;\n\n        #ifdef CROP_TEXCOORDS\n            if(uv.x<0.0 || uv.x>1.0 || uv.y<0.0 || uv.y>1.0) discard;\n        #endif\n\n        #ifdef HAS_TEXTURE_DIFFUSE\n            col=texture(tex,uv);\n\n            #ifdef COLORIZE_TEXTURE\n                col.r*=color.r;\n                col.g*=color.g;\n                col.b*=color.b;\n            #endif\n        #endif\n        col.a*=color.a;\n        #ifdef HAS_TEXTURE_OPACITY\n            #ifdef TRANSFORMALPHATEXCOORDS\n                uv=texCoordOrig;\n            #endif\n            #ifdef ALPHA_MASK_IR\n                col.a*=1.0-texture(texOpacity,uv).r;\n            #endif\n            #ifdef ALPHA_MASK_IALPHA\n                col.a*=1.0-texture(texOpacity,uv).a;\n            #endif\n            #ifdef ALPHA_MASK_ALPHA\n                col.a*=texture(texOpacity,uv).a;\n            #endif\n            #ifdef ALPHA_MASK_LUMI\n                col.a*=dot(vec3(0.2126,0.7152,0.0722), texture(texOpacity,uv).rgb);\n            #endif\n            #ifdef ALPHA_MASK_R\n                col.a*=texture(texOpacity,uv).r;\n            #endif\n            #ifdef ALPHA_MASK_G\n                col.a*=texture(texOpacity,uv).g;\n            #endif\n            #ifdef ALPHA_MASK_B\n                col.a*=texture(texOpacity,uv).b;\n            #endif\n            // #endif\n        #endif\n    #endif\n\n    {{MODULE_COLOR}}\n\n    #ifdef DISCARDTRANS\n        if(col.a<0.2) discard;\n    #endif\n\n    #ifdef VERTEX_COLORS\n        col*=vertCol;\n    #endif\n\n    outColor = col;\n}\n","basicmaterial_vert":"\n{{MODULES_HEAD}}\n\nOUT vec2 texCoord;\nOUT vec2 texCoordOrig;\n\nUNI mat4 projMatrix;\nUNI mat4 modelMatrix;\nUNI mat4 viewMatrix;\n\n#ifdef HAS_TEXTURES\n    UNI float diffuseRepeatX;\n    UNI float diffuseRepeatY;\n    UNI float texOffsetX;\n    UNI float texOffsetY;\n#endif\n\n#ifdef VERTEX_COLORS\n    in vec4 attrVertColor;\n    out vec4 vertCol;\n\n#endif\n\n\nvoid main()\n{\n    mat4 mMatrix=modelMatrix;\n    mat4 modelViewMatrix;\n\n    norm=attrVertNormal;\n    texCoordOrig=attrTexCoord;\n    texCoord=attrTexCoord;\n    #ifdef HAS_TEXTURES\n        texCoord.x=texCoord.x*diffuseRepeatX+texOffsetX;\n        texCoord.y=(1.0-texCoord.y)*diffuseRepeatY+texOffsetY;\n    #endif\n\n    #ifdef VERTEX_COLORS\n        vertCol=attrVertColor;\n    #endif\n\n    vec4 pos = vec4(vPosition, 1.0);\n\n    #ifdef BILLBOARD\n       vec3 position=vPosition;\n       modelViewMatrix=viewMatrix*modelMatrix;\n\n       gl_Position = projMatrix * modelViewMatrix * vec4((\n           position.x * vec3(\n               modelViewMatrix[0][0],\n               modelViewMatrix[1][0],\n               modelViewMatrix[2][0] ) +\n           position.y * vec3(\n               modelViewMatrix[0][1],\n               modelViewMatrix[1][1],\n               modelViewMatrix[2][1]) ), 1.0);\n    #endif\n\n    {{MODULE_VERTEX_POSITION}}\n\n    #ifndef BILLBOARD\n        modelViewMatrix=viewMatrix * mMatrix;\n\n        {{MODULE_VERTEX_MODELVIEW}}\n\n    #endif\n\n    // mat4 modelViewMatrix=viewMatrix*mMatrix;\n\n    #ifndef BILLBOARD\n        // gl_Position = projMatrix * viewMatrix * modelMatrix * pos;\n        gl_Position = projMatrix * modelViewMatrix * pos;\n    #endif\n}\n",};
const render = op.inTrigger("render");
const trigger = op.outTrigger("trigger");
const shaderOut = op.outObject("shader", null, "shader");

shaderOut.ignoreValueSerialize = true;

op.toWorkPortsNeedToBeLinked(render);
op.toWorkShouldNotBeChild("Ops.Gl.TextureEffects.ImageCompose", CABLES.OP_PORT_TYPE_FUNCTION);

const cgl = op.patch.cgl;
let diffuseTextureUniform = null;

const shader = new CGL.Shader(cgl, "basicmaterial", this);
shader.addAttribute({ "type": "vec3", "name": "vPosition" });
shader.addAttribute({ "type": "vec2", "name": "attrTexCoord" });
shader.addAttribute({ "type": "vec3", "name": "attrVertNormal", "nameFrag": "norm" });
shader.addAttribute({ "type": "float", "name": "attrVertIndex" });

shader.setModules(["MODULE_VERTEX_POSITION", "MODULE_COLOR", "MODULE_BEGIN_FRAG", "MODULE_VERTEX_MODELVIEW"]);

shader.setSource(attachments.basicmaterial_vert, attachments.basicmaterial_frag);

shaderOut.setRef(shader);

render.onTriggered = doRender;

// rgba colors
const r = op.inValueSlider("r", Math.random());
const g = op.inValueSlider("g", Math.random());
const b = op.inValueSlider("b", Math.random());
const a = op.inValueSlider("a", 1);
r.setUiAttribs({ "colorPick": true });

// const uniColor=new CGL.Uniform(shader,'4f','color',r,g,b,a);
const colUni = shader.addUniformFrag("4f", "color", r, g, b, a);

// diffuse outTexture

const diffuseTexture = op.inTexture("texture");
diffuseTexture.onChange = updateDiffuseTexture;

const colorizeTexture = op.inValueBool("colorizeTexture", false);
const vertexColors = op.inValueBool("Vertex Colors", false);

// opacity texture
const textureOpacity = op.inTexture("textureOpacity");
let textureOpacityUniform = null;

const alphaMaskSource = op.inSwitch("Alpha Mask Source", ["Luminance", "R", "G", "B", "A", "1-A", "1-R"], "Luminance");
alphaMaskSource.setUiAttribs({ "greyout": true });
textureOpacity.onChange = updateOpacity;

const texCoordAlpha = op.inValueBool("Opacity TexCoords Transform", false);
const discardTransPxl = op.inValueBool("Discard Transparent Pixels");

shader.uniformColorDiffuse = colUni; // todo remove in next versio

shader.materialPropUniforms = {
    "diffuseColor": colUni

};
// texture coords
const
    diffuseRepeatX = op.inValue("diffuseRepeatX", 1),
    diffuseRepeatY = op.inValue("diffuseRepeatY", 1),
    diffuseOffsetX = op.inValue("Tex Offset X", 0),
    diffuseOffsetY = op.inValue("Tex Offset Y", 0),
    cropRepeat = op.inBool("Crop TexCoords", false);

shader.addUniformFrag("f", "diffuseRepeatX", diffuseRepeatX);
shader.addUniformFrag("f", "diffuseRepeatY", diffuseRepeatY);
shader.addUniformFrag("f", "texOffsetX", diffuseOffsetX);
shader.addUniformFrag("f", "texOffsetY", diffuseOffsetY);

const doBillboard = op.inValueBool("billboard", false);

alphaMaskSource.onChange =
    doBillboard.onChange =
    discardTransPxl.onChange =
    texCoordAlpha.onChange =
    cropRepeat.onChange =
    vertexColors.onChange =
    colorizeTexture.onChange = updateDefines;

op.setPortGroup("Color", [r, g, b, a]);
op.setPortGroup("Color Texture", [diffuseTexture, vertexColors, colorizeTexture]);
op.setPortGroup("Opacity", [textureOpacity, alphaMaskSource, discardTransPxl, texCoordAlpha]);
op.setPortGroup("Texture Transform", [diffuseRepeatX, diffuseRepeatY, diffuseOffsetX, diffuseOffsetY, cropRepeat]);

updateOpacity();
updateDiffuseTexture();

op.preRender = function ()
{
    shader.bind();
    doRender();
    if (!shader) return;
};

function doRender()
{
    op.checkGraphicsApi();
    shader.popTextures();

    cgl.pushShader(shader);

    if (diffuseTextureUniform && diffuseTexture.get()) shader.pushTexture(diffuseTextureUniform, diffuseTexture.get().tex);
    if (textureOpacityUniform && textureOpacity.get()) shader.pushTexture(textureOpacityUniform, textureOpacity.get().tex);
    shader.materialPropUniforms.diffuseTexture = diffuseTextureUniform;

    trigger.trigger();

    cgl.popShader();
}

function updateOpacity()
{
    if (textureOpacity.get())
    {
        if (textureOpacityUniform !== null) return;
        shader.removeUniform("texOpacity");
        shader.define("HAS_TEXTURE_OPACITY");
        if (!textureOpacityUniform)textureOpacityUniform = new CGL.Uniform(shader, "t", "texOpacity");
    }
    else
    {
        shader.removeUniform("texOpacity");
        shader.removeDefine("HAS_TEXTURE_OPACITY");
        textureOpacityUniform = null;
    }

    updateDefines();
}

function updateDiffuseTexture()
{
    if (diffuseTexture.get())
    {
        if (!shader.hasDefine("HAS_TEXTURE_DIFFUSE"))shader.define("HAS_TEXTURE_DIFFUSE");
        if (!diffuseTextureUniform)diffuseTextureUniform = new CGL.Uniform(shader, "t", "texDiffuse");

        shader.materialPropUniforms.diffuseTexture = diffuseTextureUniform;
    }
    else
    {
        shader.removeUniform("texDiffuse");
        shader.removeDefine("HAS_TEXTURE_DIFFUSE");
        diffuseTextureUniform = null;
    }
    updateUi();
}

function updateUi()
{
    const hasTexture = diffuseTexture.isLinked() || textureOpacity.isLinked();
    diffuseRepeatX.setUiAttribs({ "greyout": !hasTexture });
    diffuseRepeatY.setUiAttribs({ "greyout": !hasTexture });
    diffuseOffsetX.setUiAttribs({ "greyout": !hasTexture });
    diffuseOffsetY.setUiAttribs({ "greyout": !hasTexture });
    colorizeTexture.setUiAttribs({ "greyout": !hasTexture });

    alphaMaskSource.setUiAttribs({ "greyout": !textureOpacity.get() });
    texCoordAlpha.setUiAttribs({ "greyout": !textureOpacity.get() });

    let notUsingColor = true;
    notUsingColor = diffuseTexture.get() && !colorizeTexture.get();
    r.setUiAttribs({ "greyout": notUsingColor });
    g.setUiAttribs({ "greyout": notUsingColor });
    b.setUiAttribs({ "greyout": notUsingColor });
}

function updateDefines()
{
    shader.toggleDefine("VERTEX_COLORS", vertexColors.get());
    shader.toggleDefine("CROP_TEXCOORDS", cropRepeat.get());
    shader.toggleDefine("COLORIZE_TEXTURE", colorizeTexture.get());
    shader.toggleDefine("TRANSFORMALPHATEXCOORDS", texCoordAlpha.get());
    shader.toggleDefine("DISCARDTRANS", discardTransPxl.get());
    shader.toggleDefine("BILLBOARD", doBillboard.get());

    shader.toggleDefine("ALPHA_MASK_ALPHA", alphaMaskSource.get() == "A");
    shader.toggleDefine("ALPHA_MASK_IALPHA", alphaMaskSource.get() == "1-A");
    shader.toggleDefine("ALPHA_MASK_IR", alphaMaskSource.get() == "1-R");
    shader.toggleDefine("ALPHA_MASK_LUMI", alphaMaskSource.get() == "Luminance");
    shader.toggleDefine("ALPHA_MASK_R", alphaMaskSource.get() == "R");
    shader.toggleDefine("ALPHA_MASK_G", alphaMaskSource.get() == "G");
    shader.toggleDefine("ALPHA_MASK_B", alphaMaskSource.get() == "B");
    updateUi();
}

}
};





window.addEventListener('load', function(event) {
CABLES.jsLoaded=new Event('CABLES.jsLoaded');
document.dispatchEvent(CABLES.jsLoaded);
});
