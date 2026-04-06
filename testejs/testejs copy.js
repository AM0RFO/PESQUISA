// P_4_3_2_01 — Texto moldado por imagem (com cor)
var inputText = "As questões vão surgindo e desaparecendo tomando várias formas e durações ao longo das nossas vidas. Elas são intrínsecas ao Ser Humano. Algumas delas são simples e vão sendo respondidas, outras nos perseguem a vida toda... Elas podem envolver a nossa identidade, as nossas crenças e elas trazem-nos sentimentos como eureka, desconforto, ânsia e medo. ";
var img;
var fontSizeMin = 5;
var fontSizeMax = 20;
var spacing = 8;
var threshold = 128;
var letterCounter = 0;

function preload() {
  img = loadImage("data/pic.png");
}

function setup() {
  createCanvas(600, 600);
  background(255);
  colorMode(RGB, 255);
  img.resize(width, height);
  img.loadPixels();
  drawTextFromImage();
  noLoop();
}

function drawTextFromImage() {
  textFont("Helvetica");
  noStroke();

  for (var y = 0; y < height; y += spacing) {
    for (var x = 0; x < width; x += spacing) {

      var px = img.get(x, y);
      var r = red(px);
      var g = green(px);
      var b = blue(px);

      // Brilho perceptual
      var bright = 0.299 * r + 0.587 * g + 0.114 * b;

      // Só desenha letra onde o pixel é escuro
      if (bright < threshold) {
        var fSize = map(bright, 0, threshold, fontSizeMax, fontSizeMin);
        textSize(fSize);

        // Usa a cor real do pixel
        fill(r, g, b, 180);

        var letter = inputText.charAt(letterCounter % inputText.length);
        letterCounter++;
        text(letter, x, y);
      }
    }
  }
}

function keyReleased() {
  if (key == 's' || key == 'S') saveCanvas("resultado", "png");
}