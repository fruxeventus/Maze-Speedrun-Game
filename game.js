const Direction = Object.freeze({
  North: { name: "North", dx: 0, dy: -1, opposite: "South" },
  East: { name: "East", dx: 1, dy: 0, opposite: "West" },
  South: { name: "South", dx: 0, dy: 1, opposite: "North" },
  West: { name: "West", dx: -1, dy: 0, opposite: "East" },
});

const Directions = [Direction.North, Direction.East, Direction.South, Direction.West];

class SeededRandom {
  constructor(seedText) {
    this.state = SeededRandom.hash(seedText);
  }

  next() {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  static hash(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 1;
  }
}

class MazeCell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.visited = false;
    this.walls = {
      North: true,
      East: true,
      South: true,
      West: true,
    };
  }
}

class Maze {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = [];

    for (let y = 0; y < height; y += 1) {
      const row = [];
      for (let x = 0; x < width; x += 1) row.push(new MazeCell(x, y));
      this.cells.push(row);
    }
  }

  getCell(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.cells[y][x];
  }

  canMove(fromX, fromY, directionName) {
    const cell = this.getCell(fromX, fromY);
    if (!cell || cell.walls[directionName]) return false;
    const direction = Direction[directionName];
    return Boolean(this.getCell(fromX + direction.dx, fromY + direction.dy));
  }

  removeWall(x, y, direction) {
    const current = this.getCell(x, y);
    const next = this.getCell(x + direction.dx, y + direction.dy);
    if (!current || !next) return;
    current.walls[direction.name] = false;
    next.walls[direction.opposite] = false;
  }
}

class MazeGenerator {
  static generate(width, height, random = Math.random) {
    const maze = new Maze(width, height);
    const start = maze.getCell(0, Math.floor(height / 2));
    const stack = [start];
    start.visited = true;

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = MazeGenerator.getUnvisitedNeighbors(maze, current);

      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }

      const nextStep = neighbors[Math.floor(random() * neighbors.length)];
      maze.removeWall(current.x, current.y, nextStep.direction);
      nextStep.cell.visited = true;
      stack.push(nextStep.cell);
    }

    maze.getCell(0, Math.floor(height / 2)).walls.West = false;
    maze.getCell(width - 1, Math.floor(height / 2)).walls.East = false;
    return maze;
  }

  static getUnvisitedNeighbors(maze, cell) {
    const neighbors = [];

    for (const direction of Directions) {
      const next = maze.getCell(cell.x + direction.dx, cell.y + direction.dy);
      if (next && !next.visited) neighbors.push({ cell: next, direction });
    }

    return neighbors;
  }
}

class MazePathfinder {
  static findShortestPath(maze, startX, startY, endX, endY) {
    const startKey = MazePathfinder.key(startX, startY);
    const endKey = MazePathfinder.key(endX, endY);
    const queue = [{ x: startX, y: startY }];
    const visited = new Set([startKey]);
    const cameFrom = new Map();

    while (queue.length > 0) {
      const current = queue.shift();
      const currentKey = MazePathfinder.key(current.x, current.y);
      if (currentKey === endKey) return MazePathfinder.rebuildPath(cameFrom, current);

      for (const direction of Directions) {
        if (!maze.canMove(current.x, current.y, direction.name)) continue;

        const next = {
          x: current.x + direction.dx,
          y: current.y + direction.dy,
        };
        const nextKey = MazePathfinder.key(next.x, next.y);
        if (visited.has(nextKey)) continue;

        visited.add(nextKey);
        cameFrom.set(nextKey, current);
        queue.push(next);
      }
    }

    return [];
  }

  static rebuildPath(cameFrom, end) {
    const path = [end];
    let current = end;

    while (cameFrom.has(MazePathfinder.key(current.x, current.y))) {
      current = cameFrom.get(MazePathfinder.key(current.x, current.y));
      path.push(current);
    }

    return path.reverse();
  }

  static key(x, y) {
    return `${x},${y}`;
  }
}

class Player {
  constructor(startX, startY) {
    this.startX = startX;
    this.startY = startY;
    this.x = startX;
    this.y = startY;
    this.moveProgress = 1;
    this.fromX = startX;
    this.fromY = startY;
    this.targetX = startX;
    this.targetY = startY;
    this.queuedDirection = null;
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.fromX = this.startX;
    this.fromY = this.startY;
    this.targetX = this.startX;
    this.targetY = this.startY;
    this.moveProgress = 1;
    this.queuedDirection = null;
  }

  get isMoving() {
    return this.moveProgress < 1;
  }

  queueMove(directionName) {
    this.queuedDirection = directionName;
  }

  update(deltaSeconds, maze, moveSpeed) {
    if (!this.isMoving && this.queuedDirection) {
      const didMove = this.tryStartMove(this.queuedDirection, maze);
      this.queuedDirection = null;
      return didMove;
    }

    if (!this.isMoving) return false;

    this.moveProgress = Math.min(1, this.moveProgress + deltaSeconds * moveSpeed);
    if (this.moveProgress >= 1) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.fromX = this.x;
      this.fromY = this.y;
    }
    return false;
  }

  tryStartMove(directionName, maze) {
    if (!maze.canMove(this.x, this.y, directionName)) return false;

    const direction = Direction[directionName];
    this.fromX = this.x;
    this.fromY = this.y;
    this.targetX = this.x + direction.dx;
    this.targetY = this.y + direction.dy;
    this.moveProgress = 0;
    return true;
  }

  getRenderPosition() {
    if (!this.isMoving) return { x: this.x, y: this.y };
    return {
      x: this.fromX + (this.targetX - this.fromX) * this.moveProgress,
      y: this.fromY + (this.targetY - this.fromY) * this.moveProgress,
    };
  }
}

class MazeSpeedrunGame {
  constructor(size, seed) {
    this.size = size;
    this.seed = seed;
    this.maze = null;
    this.player = null;
    this.startedAt = 0;
    this.finishedTime = null;
    this.running = false;
    this.hasStarted = false;
    this.status = "Ready";
    this.optimalPath = [];
    this.generate(size, seed);
  }

  generate(size, seed) {
    this.size = size;
    this.seed = seed;
    const random = new SeededRandom(`${seed}:${size}`);
    this.maze = MazeGenerator.generate(size, size, () => random.next());
    this.player = new Player(0, Math.floor(size / 2));
    this.optimalPath = MazePathfinder.findShortestPath(
      this.maze,
      0,
      Math.floor(size / 2),
      size - 1,
      Math.floor(size / 2),
    );
    this.startedAt = 0;
    this.finishedTime = null;
    this.running = false;
    this.hasStarted = false;
    this.status = "Ready";
  }

  restart() {
    this.player.reset();
    this.startedAt = 0;
    this.finishedTime = null;
    this.running = false;
    this.hasStarted = false;
    this.status = "Ready";
  }

  handleInput(directionName) {
    if (this.finishedTime !== null) return;
    this.player.queueMove(directionName);
  }

  update(deltaSeconds) {
    if (this.finishedTime !== null) return;

    const didStartMove = this.player.update(deltaSeconds, this.maze, 8.5);
    if (didStartMove && !this.hasStarted) {
      this.startedAt = performance.now();
      this.running = true;
      this.hasStarted = true;
      this.status = "Running";
    }

    const exitY = Math.floor(this.size / 2);
    if (!this.player.isMoving && this.player.x === this.size - 1 && this.player.y === exitY) {
      this.finishedTime = this.elapsedSeconds;
      this.running = false;
      this.status = "Finished";
    }
  }

  get elapsedSeconds() {
    if (this.finishedTime !== null) return this.finishedTime;
    if (!this.hasStarted) return 0;
    return (performance.now() - this.startedAt) / 1000;
  }
}

class CanvasMazeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
  }

  render(game, showPracticePath) {
    const ctx = this.context;
    const canvasSize = this.canvas.width;
    const padding = 28;
    const mazePixels = canvasSize - padding * 2;
    const cellSize = mazePixels / game.maze.width;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = "#101314";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    this.drawGates(ctx, game, padding, cellSize, mazePixels);
    if (showPracticePath) this.drawPracticePath(ctx, game.optimalPath, padding, cellSize);
    this.drawMaze(ctx, game.maze, padding, cellSize);
    this.drawPlayer(ctx, game.player, padding, cellSize);
  }

  drawPracticePath(ctx, path, padding, cellSize) {
    if (path.length < 2) return;

    ctx.save();
    ctx.beginPath();
    for (let index = 0; index < path.length; index += 1) {
      const point = path[index];
      const x = padding + point.x * cellSize + cellSize / 2;
      const y = padding + point.y * cellSize + cellSize / 2;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = Math.max(4, cellSize * 0.18);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 209, 102, 0.7)";
    ctx.shadowColor = "rgba(255, 209, 102, 0.75)";
    ctx.shadowBlur = Math.max(8, cellSize * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  drawGates(ctx, game, padding, cellSize, mazePixels) {
    const gateY = Math.floor(game.size / 2);
    const y = padding + gateY * cellSize;

    ctx.fillStyle = "#49e67d";
    ctx.fillRect(padding - 12, y + cellSize * 0.22, 12, cellSize * 0.56);

    ctx.fillStyle = "#ff5c6c";
    ctx.fillRect(padding + mazePixels, y + cellSize * 0.22, 12, cellSize * 0.56);
  }

  drawMaze(ctx, maze, padding, cellSize) {
    ctx.strokeStyle = "#e8eef1";
    ctx.lineWidth = Math.max(2, cellSize * 0.08);
    ctx.lineCap = "square";

    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        const cell = maze.getCell(x, y);
        const left = padding + x * cellSize;
        const top = padding + y * cellSize;
        const right = left + cellSize;
        const bottom = top + cellSize;

        ctx.beginPath();
        if (cell.walls.North) {
          ctx.moveTo(left, top);
          ctx.lineTo(right, top);
        }
        if (cell.walls.East) {
          ctx.moveTo(right, top);
          ctx.lineTo(right, bottom);
        }
        if (cell.walls.South) {
          ctx.moveTo(right, bottom);
          ctx.lineTo(left, bottom);
        }
        if (cell.walls.West) {
          ctx.moveTo(left, bottom);
          ctx.lineTo(left, top);
        }
        ctx.stroke();
      }
    }
  }

  drawPlayer(ctx, player, padding, cellSize) {
    const position = player.getRenderPosition();
    const centerX = padding + position.x * cellSize + cellSize / 2;
    const centerY = padding + position.y * cellSize + cellSize / 2;
    const radius = Math.max(5, cellSize * 0.26);

    ctx.beginPath();
    ctx.fillStyle = "#56b6ff";
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = Math.max(2, cellSize * 0.05);
    ctx.strokeStyle = "#dff3ff";
    ctx.stroke();
  }
}

class AlgorithmDemo {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.size = 6;
    this.timer = null;
    this.reset();
  }

  reset() {
    this.cells = [];
    for (let y = 0; y < this.size; y += 1) {
      const row = [];
      for (let x = 0; x < this.size; x += 1) row.push(new MazeCell(x, y));
      this.cells.push(row);
    }
    this.stack = [this.getCell(0, 0)];
    this.stack[0].visited = true;
    this.current = this.stack[0];
    this.finished = false;
    this.render();
  }

  getCell(x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return null;
    return this.cells[y][x];
  }

  step() {
    if (this.finished) return;

    while (this.stack.length > 0) {
      this.current = this.stack[this.stack.length - 1];
      const neighbors = [];

      for (const direction of Directions) {
        const next = this.getCell(this.current.x + direction.dx, this.current.y + direction.dy);
        if (next && !next.visited) neighbors.push({ cell: next, direction });
      }

      if (neighbors.length === 0) {
        this.stack.pop();
        continue;
      }

      const nextStep = neighbors[Math.floor(Math.random() * neighbors.length)];
      this.current.walls[nextStep.direction.name] = false;
      nextStep.cell.walls[nextStep.direction.opposite] = false;
      nextStep.cell.visited = true;
      this.stack.push(nextStep.cell);
      this.current = nextStep.cell;
      this.render();
      return;
    }

    this.finished = true;
    this.render();
  }

  toggleAuto(button) {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
      button.textContent = "Auto";
      return;
    }

    button.textContent = "Pause";
    this.timer = window.setInterval(() => {
      this.step();
      if (this.finished) this.toggleAuto(button);
    }, 180);
  }

  render() {
    const ctx = this.context;
    const canvasSize = Math.min(this.canvas.width, this.canvas.height);
    const padding = 28;
    const cellSize = (canvasSize - padding * 2) / this.size;
    const offsetX = (this.canvas.width - canvasSize) / 2;

    ctx.clearRect(0, 0, canvasSize, this.canvas.height);
    ctx.fillStyle = "#132027";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const cell = this.getCell(x, y);
        const left = offsetX + padding + x * cellSize;
        const top = padding + y * cellSize;

        ctx.fillStyle = cell.visited ? "#d8f5e6" : "#27343c";
        ctx.fillRect(left + 2, top + 2, cellSize - 4, cellSize - 4);

        if (this.stack.includes(cell)) {
          ctx.fillStyle = "rgba(246, 184, 75, 0.55)";
          ctx.fillRect(left + 5, top + 5, cellSize - 10, cellSize - 10);
        }

        if (cell === this.current) {
          ctx.fillStyle = "#f26457";
          ctx.beginPath();
          ctx.arc(left + cellSize / 2, top + cellSize / 2, cellSize * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }

        const right = left + cellSize;
        const bottom = top + cellSize;
        ctx.strokeStyle = "#f8f5ee";
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (cell.walls.North) {
          ctx.moveTo(left, top);
          ctx.lineTo(right, top);
        }
        if (cell.walls.East) {
          ctx.moveTo(right, top);
          ctx.lineTo(right, bottom);
        }
        if (cell.walls.South) {
          ctx.moveTo(right, bottom);
          ctx.lineTo(left, bottom);
        }
        if (cell.walls.West) {
          ctx.moveTo(left, bottom);
          ctx.lineTo(left, top);
        }
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#f8f5ee";
    ctx.font = "700 18px system-ui";
    ctx.fillText(this.finished ? "Maze complete" : `Stack size: ${this.stack.length}`, offsetX + 28, 398);
  }
}

const codeLessons = {
  cell: {
    title: "A cell is one room.",
    text:
      "Each room remembers its position and which walls are still standing. At the start, every wall is closed.",
    code: `class MazeCell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.visited = false;
    this.walls = {
      North: true,
      East: true,
      South: true,
      West: true,
    };
  }
}`,
  },
  directions: {
    title: "Directions are tiny coordinate changes.",
    text:
      "A direction tells the player how x and y should change. It also knows the opposite wall to open in the next room.",
    code: `const Direction = Object.freeze({
  North: { dx: 0, dy: -1, opposite: "South" },
  East: { dx: 1, dy: 0, opposite: "West" },
  South: { dx: 0, dy: 1, opposite: "North" },
  West: { dx: -1, dy: 0, opposite: "East" },
});`,
  },
  generator: {
    title: "The generator carves until the stack is empty.",
    text:
      "The stack is the trail of rooms we can backtrack through. When the current room has no fresh neighbors, we step backward.",
    code: `while (stack.length > 0) {
  const current = stack[stack.length - 1];
  const neighbors = getUnvisitedNeighbors(current);

  if (neighbors.length === 0) {
    stack.pop();
    continue;
  }

  const next = chooseRandom(neighbors);
  removeWallBetween(current, next);
  next.cell.visited = true;
  stack.push(next.cell);
}`,
  },
  path: {
    title: "The shortest path uses a queue.",
    text:
      "Breadth-first search checks nearby rooms first. The first time it reaches the exit, it has found the shortest route.",
    code: `const queue = [start];
const visited = new Set([startKey]);

while (queue.length > 0) {
  const current = queue.shift();
  if (current === exit) return rebuildPath();

  for (const neighbor of openNeighbors(current)) {
    if (visited.has(neighbor.key)) continue;
    visited.add(neighbor.key);
    cameFrom.set(neighbor.key, current);
    queue.push(neighbor);
  }
}`,
  },
};

function initializeLessonTools() {
  initializeGridInspector();
  initializeMathLab();
  initializeCodeTabs();
  initializeAlgorithmDemo();
  initializeHeroPreview();
}

function initializeGridInspector() {
  const grid = document.querySelector("#gridInspector");
  const readout = document.querySelector("#gridReadout");
  if (!grid || !readout) return;

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "grid-cell";
      button.textContent = `${x},${y}`;
      button.addEventListener("click", () => {
        grid.querySelectorAll(".grid-cell").forEach((cell) => cell.classList.remove("active"));
        button.classList.add("active");
        readout.textContent = `Room address: x = ${x}, y = ${y}`;
      });
      grid.appendChild(button);
      if (x === 0 && y === 0) button.classList.add("active");
    }
  }
}

function initializeMathLab() {
  const slider = document.querySelector("#mathSize");
  const roomCount = document.querySelector("#roomCount");
  const doorCount = document.querySelector("#doorCount");
  const wallSwitchCount = document.querySelector("#wallSwitchCount");
  if (!slider || !roomCount || !doorCount || !wallSwitchCount) return;

  const update = () => {
    const size = Number(slider.value);
    const rooms = size * size;
    roomCount.textContent = rooms.toString();
    doorCount.textContent = (rooms - 1).toString();
    wallSwitchCount.textContent = (rooms * 4).toString();
  };

  slider.addEventListener("input", update);
  update();
}

function initializeCodeTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const text = document.querySelector("#codeLessonText");
  const block = document.querySelector("#codeBlock");
  if (!buttons.length || !text || !block) return;

  const showLesson = (name) => {
    const lesson = codeLessons[name];
    text.innerHTML = `<strong>${lesson.title}</strong>${lesson.text}`;
    block.textContent = lesson.code;
    buttons.forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => showLesson(button.dataset.tab));
  });

  showLesson("cell");
}

function initializeAlgorithmDemo() {
  const canvas = document.querySelector("#algorithmCanvas");
  const stepButton = document.querySelector("#algoStepButton");
  const autoButton = document.querySelector("#algoAutoButton");
  const resetButton = document.querySelector("#algoResetButton");
  if (!canvas || !stepButton || !autoButton || !resetButton) return;

  const demo = new AlgorithmDemo(canvas);
  stepButton.addEventListener("click", () => demo.step());
  autoButton.addEventListener("click", () => demo.toggleAuto(autoButton));
  resetButton.addEventListener("click", () => {
    if (demo.timer) demo.toggleAuto(autoButton);
    demo.reset();
  });
}

function initializeHeroPreview() {
  const canvas = document.querySelector("#heroCanvas");
  if (!canvas) return;

  const previewRandom = new SeededRandom("academy-preview");
  const previewMaze = MazeGenerator.generate(12, 12, () => previewRandom.next());
  const previewPath = MazePathfinder.findShortestPath(previewMaze, 0, 6, 11, 6);
  const ctx = canvas.getContext("2d");
  let pulse = 0;

  const draw = () => {
    const canvasSize = canvas.width;
    const padding = 26;
    const cellSize = (canvasSize - padding * 2) / previewMaze.width;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#132027";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.beginPath();
    previewPath.forEach((point, index) => {
      const x = padding + point.x * cellSize + cellSize / 2;
      const y = padding + point.y * cellSize + cellSize / 2;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineWidth = 9 + Math.sin(pulse) * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(246, 184, 75, 0.76)";
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "#f8f5ee";
    ctx.lineWidth = 3;
    for (let y = 0; y < previewMaze.height; y += 1) {
      for (let x = 0; x < previewMaze.width; x += 1) {
        const cell = previewMaze.getCell(x, y);
        const left = padding + x * cellSize;
        const top = padding + y * cellSize;
        const right = left + cellSize;
        const bottom = top + cellSize;
        ctx.beginPath();
        if (cell.walls.North) {
          ctx.moveTo(left, top);
          ctx.lineTo(right, top);
        }
        if (cell.walls.East) {
          ctx.moveTo(right, top);
          ctx.lineTo(right, bottom);
        }
        if (cell.walls.South) {
          ctx.moveTo(right, bottom);
          ctx.lineTo(left, bottom);
        }
        if (cell.walls.West) {
          ctx.moveTo(left, bottom);
          ctx.lineTo(left, top);
        }
        ctx.stroke();
      }
    }

    const runner = previewPath[Math.floor(((Math.sin(pulse * 0.55) + 1) / 2) * (previewPath.length - 1))];
    ctx.fillStyle = "#3777ff";
    ctx.beginPath();
    ctx.arc(
      padding + runner.x * cellSize + cellSize / 2,
      padding + runner.y * cellSize + cellSize / 2,
      cellSize * 0.28,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    pulse += 0.035;
    requestAnimationFrame(draw);
  };

  draw();
}

const canvas = document.querySelector("#mazeCanvas");
const sizeSlider = document.querySelector("#mazeSize");
const sizeValue = document.querySelector("#mazeSizeValue");
const generateButton = document.querySelector("#generateButton");
const restartButton = document.querySelector("#restartButton");
const sideCurrentTime = document.querySelector("#sideCurrentTime");
const sideBestTime = document.querySelector("#sideBestTime");
const timerText = document.querySelector("#timer") || sideCurrentTime;
const bestTimeText = document.querySelector("#bestTime") || sideBestTime;
const movementText = document.querySelector("#movementText");
const movementModeInputs = document.querySelectorAll("input[name='movementMode']");
const seedModeInputs = document.querySelectorAll("input[name='seedMode']");
const seedInput = document.querySelector("#seedInput");
const practicePathToggle = document.querySelector("#practicePathToggle");
const newBestText = document.querySelector("#newBestText");

const inputMap = {
  ArrowUp: "North",
  KeyW: "North",
  ArrowRight: "East",
  KeyD: "East",
  ArrowDown: "South",
  KeyS: "South",
  ArrowLeft: "West",
  KeyA: "West",
};

const restartKey = "KeyR";

let currentSeed = makeSeed();
let game = new MazeSpeedrunGame(Number(sizeSlider.value), currentSeed);
let renderer = new CanvasMazeRenderer(canvas);
let lastFrame = performance.now();
let bestTime = 0;
let movementMode = document.querySelector("input[name='movementMode']:checked").value;
let seedMode = document.querySelector("input[name='seedMode']:checked").value;
let showPracticePath = practicePathToggle.checked;
let currentRunKey = "";
let nextSeedTimer = null;
let heldDirection = null;
let finishHandled = false;
const heldKeys = new Map();
const bestTimesByRun = new Map();

function formatTime(seconds) {
  if (!seconds) return "--";
  return `${seconds.toFixed(2)}s`;
}

function formatTimer(seconds) {
  return `${seconds.toFixed(2)}s`;
}

function makeSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function runKey(size, seed) {
  return `${size}:${seed}`;
}

function syncControls() {
  const size = Number(sizeSlider.value);
  sizeValue.textContent = `${size} x ${size}`;
  updateBestDisplays();
  movementText.textContent = "Use WASD or arrow keys to move";
  practicePathToggle.disabled = seedMode !== "fixed";
  if (seedMode !== "fixed" && practicePathToggle.checked) {
    practicePathToggle.checked = false;
    showPracticePath = false;
  }
}

function resizeCanvasForDisplay() {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const nextSize = Math.max(420, Math.floor(rect.width * pixelRatio));
  if (canvas.width !== nextSize || canvas.height !== nextSize) {
    canvas.width = nextSize;
    canvas.height = nextSize;
  }
}

function generateMaze() {
  const size = Number(sizeSlider.value);
  const seed = makeSeed();
  startMaze(size, seed);
}

function startMaze(size, seed) {
  const nextRunKey = runKey(size, seed);
  if (currentRunKey) bestTimesByRun.set(currentRunKey, bestTime);
  if (nextRunKey !== currentRunKey) bestTime = bestTimesByRun.get(nextRunKey) || 0;

  currentSeed = seed;
  currentRunKey = nextRunKey;
  seedInput.value = seed;
  game.generate(size, seed);
  finishHandled = false;
  heldDirection = null;
  heldKeys.clear();
  clearNextSeedTimer();
  hideNewBestText();
  timerText.textContent = formatTimer(0);
  sideCurrentTime.textContent = formatTimer(0);
  updateBestDisplays();
}

function cleanSeed(seed) {
  const cleaned = seed.trim().toUpperCase();
  return cleaned || makeSeed();
}

function handleFinishedRun() {
  if (game.finishedTime === null || finishHandled) return;

  const hadPreviousBest = bestTime > 0;
  const beatPreviousBest = hadPreviousBest && game.finishedTime < bestTime;

  if (beatPreviousBest) showNewBestText();
  if (!hadPreviousBest || game.finishedTime < bestTime) bestTime = game.finishedTime;
  bestTimesByRun.set(currentRunKey, bestTime);

  finishHandled = true;
  if (seedMode === "fresh") scheduleFreshSeed();
}

function updateBestDisplays() {
  const bestText = formatTime(bestTime);
  bestTimeText.textContent = bestText;
  sideBestTime.textContent = bestText;

  const isAheadOfBest = bestTime > 0 && game.hasStarted && game.finishedTime === null && game.elapsedSeconds < bestTime;
  timerText.classList.toggle("pace-ahead", isAheadOfBest);
  sideCurrentTime.classList.toggle("pace-ahead", isAheadOfBest);
  sideBestTime.classList.toggle("pace-ahead", isAheadOfBest);
}

function showNewBestText() {
  newBestText.classList.remove("hidden");
  newBestText.style.animation = "none";
  newBestText.offsetHeight;
  newBestText.style.animation = "";
}

function hideNewBestText() {
  newBestText.classList.add("hidden");
  newBestText.style.animation = "";
}

newBestText.addEventListener("animationend", () => {
  hideNewBestText();
});

function updateFinishedRun() {
  if (!finishHandled && game.finishedTime !== null) {
    handleFinishedRun();
  }
}

function updateHeldMovement() {
  if (movementMode !== "hold" || !heldDirection || game.player.isMoving) return;
  game.handleInput(heldDirection);
}

function scheduleFreshSeed() {
  clearNextSeedTimer();
  nextSeedTimer = window.setTimeout(() => {
    startMaze(Number(sizeSlider.value), makeSeed());
  }, 1300);
}

function clearNextSeedTimer() {
  if (!nextSeedTimer) return;
  window.clearTimeout(nextSeedTimer);
  nextSeedTimer = null;
}

function animationLoop(now) {
  const deltaSeconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  resizeCanvasForDisplay();
  updateHeldMovement();
  game.update(deltaSeconds);
  updateFinishedRun();

  const currentTimeText = formatTimer(game.elapsedSeconds);
  timerText.textContent = currentTimeText;
  sideCurrentTime.textContent = currentTimeText;
  updateBestDisplays();
  renderer.render(game, showPracticePath);

  requestAnimationFrame(animationLoop);
}

sizeSlider.addEventListener("input", syncControls);
generateButton.addEventListener("click", generateMaze);
restartButton.addEventListener("click", () => {
  restartRun();
});

function restartRun() {
  if (seedMode === "fresh") {
    startMaze(Number(sizeSlider.value), makeSeed());
    return;
  }

  startMaze(Number(sizeSlider.value), cleanSeed(seedInput.value));
}

movementModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    movementMode = document.querySelector("input[name='movementMode']:checked").value;
    heldDirection = null;
    heldKeys.clear();
    syncControls();
  });
});

seedModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    seedMode = document.querySelector("input[name='seedMode']:checked").value;
    if (seedMode === "fresh") startMaze(Number(sizeSlider.value), makeSeed());
    else startMaze(Number(sizeSlider.value), cleanSeed(seedInput.value));
    syncControls();
  });
});

practicePathToggle.addEventListener("change", () => {
  showPracticePath = practicePathToggle.checked && seedMode === "fixed";
});

seedInput.addEventListener("change", () => {
  if (seedMode !== "fixed") return;
  startMaze(Number(sizeSlider.value), cleanSeed(seedInput.value));
});

window.addEventListener("keydown", (event) => {
  if (isTypingInControl(event.target)) return;

  if (event.code === restartKey) {
    event.preventDefault();
    restartRun();
    return;
  }

  const direction = inputMap[event.code];
  if (!direction) return;

  event.preventDefault();
  heldKeys.set(event.code, direction);
  heldDirection = direction;

  if (movementMode === "tap") {
    if (event.repeat) return;
    game.handleInput(direction);
  } else if (!game.player.isMoving) {
    game.handleInput(direction);
  }
});

window.addEventListener("keyup", (event) => {
  if (isTypingInControl(event.target)) return;

  if (!inputMap[event.code]) return;

  event.preventDefault();
  heldKeys.delete(event.code);
  const remainingDirections = Array.from(heldKeys.values());
  heldDirection = remainingDirections.length > 0 ? remainingDirections[remainingDirections.length - 1] : null;
});

window.addEventListener("resize", resizeCanvasForDisplay);

function isTypingInControl(target) {
  return target instanceof HTMLInputElement && target.type === "text";
}

initializeLessonTools();
startMaze(Number(sizeSlider.value), currentSeed);
syncControls();
requestAnimationFrame(animationLoop);
