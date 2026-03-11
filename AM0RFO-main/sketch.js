
let rings = [];
let numRings = 50;
let currentRing = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);

  for (let i = 0; i < numRings; i++) {
    rings[i] = new Ring();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(0);

  for (let i = 0; i < rings.length; i++) {
    rings[i].grow();
    rings[i].display();
  }
}

function mousePressed() {
  rings[currentRing].start(mouseX, mouseY);

  currentRing++;

  if (currentRing >= numRings) {
    currentRing = 0;
  }
}

class Ring {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.diameter = 0;
    this.on = false;
  }

  start(xpos, ypos) {
    this.x = xpos;
    this.y = ypos;
    this.diameter = 1;
    this.on = true;
  }

  grow() {
    if (this.on) {
      this.diameter += 0.5;

      if (this.diameter > 400) {
        this.on = false;
        this.diameter = 1;
      }
    }
  }

  display() {
    if (this.on) {
      noFill();
      strokeWeight(4);
      stroke(204, 153);
      ellipse(this.x, this.y, this.diameter, this.diameter);
    }
  }
}
