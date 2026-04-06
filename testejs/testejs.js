// P_4_3_2 — Texto moldado por imagem (merged)
var inputText = "O teu texto aqui repetido vezes sem conta para preencher a forma ";
var fontSizeMax = 20;
var fontSizeMin = 10;
var spacing = 12;
var kerning = 0.5;
var threshold = 128;      // só desenha letras abaixo deste brilho
var fontSizeStatic = false;
var blackAndWhite = false;
var img;

function preload() {
  img = loadImage('data/pic.png');
}

function setup() {
  createCanvas(img.width/5, img.height/5);
  textFont('Times');
  textSize(10);
  textAlign(LEFT, CENTER);
}

function draw() {
  background(255);
  img.loadPixels();

  var x = 0;
  var y = 10;
  var counter = 0;

  while (y < height) {
    var imgX = round(map(x, 0, width, 0, img.width));
    var imgY = round(map(y, 0, height, 0, img.height));
    var c = color(img.get(imgX, imgY));

    var greyscale = round(red(c) * 0.222 + green(c) * 0.707 + blue(c) * 0.071);

    push();
    translate(x, y);

    if (fontSizeStatic) {
      textSize(fontSizeMax);
      if (blackAndWhite) {
        fill(greyscale);
      } else {
        fill(c);
      }
    } else {
      var fontSize = map(greyscale, 0, 255, fontSizeMax, fontSizeMin);
      fontSize = max(fontSize, 1);
      textSize(fontSize);
      if (blackAndWhite) {
        fill(0);
      } else {
        fill(c);
      }
    }

    // só desenha a letra se o pixel for suficientemente escuro
    if (greyscale < threshold) {
      var letter = inputText.charAt(counter);
      text(letter, 0, 0);
    }

    // avança sempre (com ou sem letra) para manter o fluxo
    var fontSize2 = fontSizeStatic ? fontSizeMax : map(greyscale, 0, 255, fontSizeMax, fontSizeMin);
    textSize(max(fontSize2, 1));
    var letterWidth = textWidth(inputText.charAt(counter)) + kerning;
    x += letterWidth;

    pop();

    if (x + letterWidth >= width) {
      x = 0;
      y += spacing;
    }

    counter++;
    if (counter >= inputText.length) counter = 0;
  }

  noLoop();
}

function keyReleased() {
  if (key == 's' || key == 'S') saveCanvas('resultado', 'png');
  if (key == '1') fontSizeStatic = !fontSizeStatic;
  if (key == '2') blackAndWhite = !blackAndWhite;
  print('fontSizeMin: ' + fontSizeMin + ', fontSizeMax: ' + fontSizeMax +
        ', fontSizeStatic: ' + fontSizeStatic + ', blackAndWhite: ' + blackAndWhite +
        ', threshold: ' + threshold);
  loop();
}

function keyPressed() {
  if (keyCode == UP_ARROW)    fontSizeMax += 2;
  if (keyCode == DOWN_ARROW)  fontSizeMax -= 2;
  if (keyCode == RIGHT_ARROW) fontSizeMin += 2;
  if (keyCode == LEFT_ARROW)  fontSizeMin -= 2;
  loop();
}