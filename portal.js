/* ==========================================================================
   AURA MASTERCLASS - INTERACTIVE PORTAL CONTROLLER
   ========================================================================== */

class MasterclassPortal {
    constructor() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.sections = document.querySelectorAll('.reader-section');
        
        // Lab Panel UI
        this.labCanvas = document.getElementById('labCanvas');
        this.labCtx = this.labCanvas.getContext('2d');
        this.labTitle = document.getElementById('labInfoTitle');
        this.labDesc = document.getElementById('labInfoDesc');
        this.labScoreVal = document.getElementById('labScoreVal');
        this.labBestVal = document.getElementById('labBestVal');
        this.labOverlayText = document.getElementById('labOverlayText');
        this.btnResetLab = document.getElementById('btnResetLab');
        
        // Setup scaling for Retina/High-DPI
        this.resizeLabCanvas();
        window.addEventListener('resize', () => this.resizeLabCanvas());

        // Active State variables
        this.activeSimulator = 'tap'; // Default simulator
        this.scores = {
            tap: 0, stack: 0, timing: 0, puzzle: 0, grow: 0, swerve: 0, destroy: 0
        };
        this.bests = {
            tap: 0, stack: 0, timing: 0, puzzle: 0, grow: 0, swerve: 0, destroy: 0
        };

        // Load best scores from storage
        const savedBests = localStorage.getItem('portal_bests');
        if (savedBests) {
            this.bests = JSON.parse(savedBests);
        }

        // Initialize HUD
        this.updateLabHUD();

        // Simulator Game Loop State
        this.simState = {};
        this.lastTime = 0;
        this.inputActive = false;

        // Setup Listeners
        this.initEvents();

        // Switch to default simulator
        this.switchSimulator('tap');

        // Start requestAnimationFrame loop
        requestAnimationFrame((t) => this.loop(t));
    }

    resizeLabCanvas() {
        const rect = this.labCanvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.labCanvas.width = rect.width * dpr;
        this.labCanvas.height = rect.height * dpr;
        this.labCtx.scale(dpr, dpr);
        
        this.width = rect.width;
        this.height = rect.height;
    }

    initEvents() {
        // Navigation clicks
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.getAttribute('data-target');
                const simulator = item.getAttribute('data-simulator');
                
                // Switch sidebar tab
                this.navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Show content section
                this.sections.forEach(sec => sec.classList.remove('active'));
                const activeSection = document.getElementById(`content-${target}`);
                if (activeSection) {
                    activeSection.classList.add('active');
                    // Scroll to top of content reader
                    activeSection.parentElement.scrollTop = 0;
                }

                // If a simulator is linked, switch to it
                if (simulator) {
                    this.switchSimulator(simulator);
                }
                
                // If switching to arcade, pause portal simulator loop calculations
                if (target === 'arcade' && window.game) {
                    window.game.goToMenu();
                }
            });
        });

        // Reset sandbox button
        this.btnResetLab.addEventListener('click', () => {
            this.initSimulatorState(this.activeSimulator);
        });

        // Click / Mouse events inside sandbox canvas
        this.labCanvas.addEventListener('mousedown', (e) => this.handleLabInputStart(e));
        this.labCanvas.addEventListener('mousemove', (e) => this.handleLabInputMove(e));
        window.addEventListener('mouseup', (e) => this.handleLabInputEnd(e));

        // Touch events inside sandbox canvas
        this.labCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleLabInputStart(e.touches[0]);
        }, { passive: false });
        
        this.labCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleLabInputMove(e.touches[0]);
        }, { passive: false });

        this.labCanvas.addEventListener('touchend', (e) => {
            this.handleLabInputEnd(e);
        });
    }

    // Get mouse position relative to scaled canvas coordinates
    getMousePos(e) {
        const rect = this.labCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // --------------------------------------------------------------------------
    // SIMULATOR SELECTION & REGISTRY
    // --------------------------------------------------------------------------
    switchSimulator(type) {
        this.activeSimulator = type;
        this.initSimulatorState(type);
        this.updateLabHUD();

        // Update info card text based on active simulator
        switch (type) {
            case 'tap':
                this.labTitle.innerText = "Tap-to-Play Controls";
                this.labDesc.innerText = "Click inside the viewport or tap spacebar to apply upward lift to the ball. Time your flaps to navigate between the moving obstacles.";
                this.labOverlayText.innerText = "TAP TO FLAP";
                break;
            case 'stack':
                this.labTitle.innerText = "Stacking & Building";
                this.labDesc.innerText = "Click to drop the sliding block onto the tower. Overlapping zones stay stacked, while sections hanging off are sliced off by the engine.";
                this.labOverlayText.innerText = "TAP TO PLACE";
                break;
            case 'timing':
                this.labTitle.innerText = "Timing & Reflex Sandbox";
                this.labDesc.innerText = "Tapping checks if the needle aligns with the green target sector of the wheel. Gaps decrease in size as scores rise.";
                this.labOverlayText.innerText = "TAP IN GREEN ZONE";
                break;
            case 'puzzle':
                this.labTitle.innerText = "Drawing Physics Solver";
                this.labDesc.innerText = "Drag your finger or cursor to draw barrier walls. Use these drawn structures to bounce the falling balls into the glass cup.";
                this.labOverlayText.innerText = "DRAW LINES TO GUIDE";
                break;
            case 'grow':
                this.labTitle.innerText = "Growing & Expanding Orb";
                this.labDesc.innerText = "Drag the center orb to consume smaller dust nodes. Notice the camera panning simulation as you grow larger.";
                this.labOverlayText.innerText = "DRAG ORB TO CONSUME";
                break;
            case 'swerve':
                this.labTitle.innerText = "Swerve & Multiplier runner";
                this.labDesc.innerText = "Slide horizontally to guide the block. Steer through green multiplier gates (+5, x2) and dodge red spiked hazards.";
                this.labOverlayText.innerText = "SWIPE LEFT & RIGHT";
                break;
            case 'destroy':
                this.labTitle.innerText = "Satisfying ASMR Shatter";
                this.labDesc.innerText = "Click anywhere on the sandbox to fire a projectile. Watch blocks shatter and collapse using 2D gravity physics.";
                this.labOverlayText.innerText = "TAP SCREEN TO BLAST";
                break;
        }
    }

    updateLabHUD() {
        this.labScoreVal.innerText = this.scores[this.activeSimulator];
        this.labBestVal.innerText = this.bests[this.activeSimulator];
    }

    addScore(amount = 1) {
        const type = this.activeSimulator;
        this.scores[type] += amount;
        
        if (this.scores[type] > this.bests[type]) {
            this.bests[type] = this.scores[type];
            localStorage.setItem('portal_bests', JSON.stringify(this.bests));
        }
        
        this.updateLabHUD();
    }

    resetScore() {
        this.scores[this.activeSimulator] = 0;
        this.updateLabHUD();
    }

    // --------------------------------------------------------------------------
    // INDIVIDUAL SIMULATOR LOGIC & RUNTIME STATES
    // --------------------------------------------------------------------------
    initSimulatorState(type) {
        this.resetScore();
        this.simState = { type: type, over: false };
        const state = this.simState;

        switch (type) {
            case 'tap':
                state.ball = { x: 50, y: 150, radius: 10, velocity: 0, gravity: 380, jump: -150 };
                state.obstacles = [];
                state.spawnTimer = 0;
                state.speed = 100;
                break;
                
            case 'stack':
                state.blocks = [{ x: 60, w: 100, z: 280, color: 'hsl(240, 75%, 50%)' }];
                state.active = { x: -80, w: 100, z: 260, dir: 1, speed: 140, color: 'hsl(260, 75%, 50%)' };
                state.debris = [];
                break;
                
            case 'timing':
                state.wheelAngle = 0;
                state.wheelSpeed = 1.2;
                state.needleAngle = 0;
                state.targetSector = { start: 1.0, end: 2.0 }; // Angle range in radians
                break;
                
            case 'puzzle':
                state.balls = [];
                state.lines = [];
                state.cup = { x: this.width * 0.7 || 220, y: this.height - 40, w: 60, h: 40 };
                state.spawnTimer = 0;
                break;
                
            case 'grow':
                state.player = { x: 100, y: 180, radius: 15, targetX: 100, targetY: 180 };
                state.dots = [];
                // Pre-populate particles
                for (let i = 0; i < 20; i++) {
                    state.dots.push({
                        x: Math.random() * 260 + 20,
                        y: Math.random() * 320 + 20,
                        radius: 3,
                        color: `hsl(${Math.random() * 360}, 80%, 60%)`
                    });
                }
                break;
                
            case 'swerve':
                state.playerX = 150;
                state.targetPlayerX = 150;
                state.elements = [];
                state.spawnTimer = 0;
                state.speed = 120;
                break;
                
            case 'destroy':
                state.blocks = [];
                state.particles = [];
                // Build a simple stacked block wall
                const rows = 5;
                const cols = 6;
                const bw = 40;
                const bh = 18;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        state.blocks.push({
                            x: 35 + c * 42,
                            y: 80 + r * 20,
                            w: bw,
                            h: bh,
                            color: `hsl(${(240 + r * 20) % 360}, 75%, 55%)`,
                            active: true
                        });
                    }
                }
                break;
        }
    }

    // --------------------------------------------------------------------------
    // INPUT HANDLERS
    // --------------------------------------------------------------------------
    handleLabInputStart(e) {
        const mouse = this.getMousePos(e);
        this.inputActive = true;
        
        const state = this.simState;
        if (state.over) {
            this.initSimulatorState(this.activeSimulator);
            return;
        }

        switch (this.activeSimulator) {
            case 'tap':
                // Apply upward velocity
                state.ball.velocity = state.ball.jump;
                if (window.game && audio.enabled) audio.playPerfect(3);
                break;
                
            case 'stack':
                this.handleStackClick();
                break;
                
            case 'timing':
                this.handleTimingClick();
                break;
                
            case 'puzzle':
                // Start line drawing
                state.activeLine = [mouse];
                break;
                
            case 'grow':
                state.player.targetX = mouse.x;
                state.player.targetY = mouse.y;
                break;
                
            case 'swerve':
                state.targetPlayerX = mouse.x;
                break;
                
            case 'destroy':
                this.handleDestroyClick(mouse);
                break;
        }
    }

    handleLabInputMove(e) {
        if (!this.inputActive) return;
        const mouse = this.getMousePos(e);
        const state = this.simState;

        switch (this.activeSimulator) {
            case 'puzzle':
                if (state.activeLine) {
                    state.activeLine.push(mouse);
                }
                break;
            case 'grow':
                state.player.targetX = mouse.x;
                state.player.targetY = mouse.y;
                break;
            case 'swerve':
                // Restrict player X coordinates to track boundaries
                state.targetPlayerX = Math.max(30, Math.min(this.width - 30, mouse.x));
                break;
        }
    }

    handleLabInputEnd(e) {
        this.inputActive = false;
        const state = this.simState;

        if (this.activeSimulator === 'puzzle' && state.activeLine) {
            // Commit drawn line
            if (state.activeLine.length > 1) {
                state.lines.push(state.activeLine);
            }
            state.activeLine = null;
        }
    }

    // Simulator specific actions
    handleStackClick() {
        const state = this.simState;
        const act = state.active;
        const base = state.blocks[state.blocks.length - 1];
        
        const diff = act.x - base.x;
        const offset = Math.abs(diff);

        if (offset < 8) {
            // Perfect snap
            act.x = base.x;
            this.addScore(2);
            if (window.game) audio.playPerfect(6);
            
            state.blocks.push({ x: act.x, w: act.w, z: act.z, color: act.color });
            
            // Advance active block
            state.active = {
                x: -80,
                w: act.w,
                z: act.z - BLOCK_HEIGHT, // Build down on 2D screen coordinate simulation
                dir: 1,
                speed: act.speed + 10,
                color: `hsl(${(240 + state.blocks.length * 15) % 360}, 75%, 50%)`
            };
        } else if (offset >= act.w) {
            // Complete miss
            state.over = true;
            this.labOverlayText.innerText = "GAME OVER. TAP TO RESET";
            if (window.game) audio.playCrash();
        } else {
            // Partial slice
            const newW = act.w - offset;
            const placedX = base.x + diff / 2;
            
            // Debris math
            const debrisW = offset;
            const debrisX = placedX + Math.sign(diff) * (act.w / 2);
            
            state.debris.push({
                x: debrisX,
                w: debrisW,
                z: act.z,
                color: act.color,
                vy: 0,
                gravity: 250
            });

            this.addScore(1);
            if (window.game) audio.playChop();

            state.blocks.push({ x: placedX, w: newW, z: act.z, color: act.color });
            
            state.active = {
                x: -80,
                w: newW,
                z: act.z - BLOCK_HEIGHT,
                dir: 1,
                speed: act.speed + 10,
                color: `hsl(${(240 + state.blocks.length * 15) % 360}, 75%, 50%)`
            };
        }
    }

    handleTimingClick() {
        const state = this.simState;
        // Check if needle is inside targetSector
        // Normalize values between 0 and 2PI
        const needle = state.needleAngle % (Math.PI * 2);
        const start = state.targetSector.start % (Math.PI * 2);
        const end = state.targetSector.end % (Math.PI * 2);

        let hit = false;
        if (start < end) {
            hit = needle >= start && needle <= end;
        } else {
            // Wraps around boundary
            hit = needle >= start || needle <= end;
        }

        if (hit) {
            this.addScore(1);
            if (window.game) audio.playPerfect(4);
            
            // Speed up and randomise new green sector
            state.wheelSpeed = Math.min(3.5, state.wheelSpeed + 0.15);
            const size = Math.max(0.4, 1.2 - this.scores.timing * 0.05); // Shrink target segment
            const randStart = Math.random() * Math.PI * 2;
            state.targetSector = {
                start: randStart,
                end: randStart + size
            };
        } else {
            this.resetScore();
            if (window.game) audio.playCrash();
            state.wheelSpeed = 1.2;
        }
    }

    handleDestroyClick(mouse) {
        const state = this.simState;
        
        // Launch a demolition ball from bottom center
        const spawnX = this.width / 2;
        const spawnY = this.height;
        
        const dx = mouse.x - spawnX;
        const dy = mouse.y - spawnY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const speed = 400;
        const ball = {
            x: spawnX,
            y: spawnY,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            radius: 8
        };

        state.projectile = ball;
        if (window.game) audio.playChop();
    }

    // --------------------------------------------------------------------------
    // MAIN LOOP UPDATES & SIMULATOR DRAWERS
    // --------------------------------------------------------------------------
    update(dt) {
        const state = this.simState;
        if (state.over) return;

        switch (this.activeSimulator) {
            case 'tap':
                // Update flapping ball
                state.ball.velocity += state.ball.gravity * dt;
                state.ball.y += state.ball.velocity * dt;
                
                // Keep inside bounds
                if (state.ball.y > this.height - 10) {
                    state.ball.y = this.height - 10;
                    state.ball.velocity = 0;
                } else if (state.ball.y < 10) {
                    state.ball.y = 10;
                    state.ball.velocity = 0;
                }

                // Move obstacles
                state.spawnTimer += dt;
                if (state.spawnTimer > 2.0) {
                    state.spawnTimer = 0;
                    const gapY = Math.random() * (this.height - 150) + 40;
                    const gapH = 90; // Height of passing window
                    state.obstacles.push({
                        x: this.width,
                        w: 24,
                        gapY: gapY,
                        gapH: gapH,
                        passed: false
                    });
                }

                for (let i = state.obstacles.length - 1; i >= 0; i--) {
                    const obs = state.obstacles[i];
                    obs.x -= state.speed * dt;

                    // Check collisions
                    const bx = state.ball.x;
                    const by = state.ball.y;
                    const br = state.ball.radius;

                    if (bx + br > obs.x && bx - br < obs.x + obs.w) {
                        if (by - br < obs.gapY || by + br > obs.gapY + obs.gapH) {
                            // Hit hurdle!
                            state.over = true;
                            this.labOverlayText.innerText = "GAME OVER. CLICK TO RESET";
                            if (window.game) audio.playCrash();
                        }
                    }

                    // Score increment on pass
                    if (!obs.passed && obs.x + obs.w < bx) {
                        obs.passed = true;
                        this.addScore(1);
                    }

                    // Prune
                    if (obs.x + obs.w < 0) {
                        state.obstacles.splice(i, 1);
                    }
                }
                break;
                
            case 'stack':
                // Slide active block
                const act = state.active;
                const limit = 110;
                
                act.x += act.speed * act.dir * dt;
                if (act.x > limit) {
                    act.x = limit;
                    act.dir = -1;
                } else if (act.x < -limit) {
                    act.x = -limit;
                    act.dir = 1;
                }

                // Update falling debris physics
                for (let i = state.debris.length - 1; i >= 0; i--) {
                    const deb = state.debris[i];
                    deb.vy += deb.gravity * dt;
                    deb.z += deb.vy * dt;
                    
                    if (deb.z > this.height + 100) {
                        state.debris.splice(i, 1);
                    }
                }
                break;
                
            case 'timing':
                // Spin needle
                state.needleAngle += state.wheelSpeed * dt;
                break;
                
            case 'puzzle':
                // Auto spawn puzzle balls from top
                state.spawnTimer += dt;
                if (state.spawnTimer > 1.2) {
                    state.spawnTimer = 0;
                    state.balls.push({
                        x: Math.random() * (this.width - 60) + 30,
                        y: 10,
                        vx: (Math.random() - 0.5) * 40,
                        vy: 0,
                        radius: 6,
                        gravity: 180
                    });
                }

                // Physics loops for balls
                for (let i = state.balls.length - 1; i >= 0; i--) {
                    const b = state.balls[i];
                    b.vy += b.gravity * dt;
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;

                    // Bounce off drawn lines
                    state.lines.forEach(line => {
                        for (let j = 0; j < line.length - 1; j++) {
                            const p1 = line[j];
                            const p2 = line[j+1];
                            
                            // Check vector intersection/collision with line segment
                            const dist = this.distToSegment({ x: b.x, y: b.y }, p1, p2);
                            if (dist < b.radius + 2) {
                                // Simple normal reflection
                                const dx = p2.x - p1.x;
                                const dy = p2.y - p1.y;
                                const len = Math.sqrt(dx*dx + dy*dy);
                                const nx = -dy / len;
                                const ny = dx / len;
                                
                                // Reflect velocity vector
                                const dot = b.vx * nx + b.vy * ny;
                                b.vx = (b.vx - 2 * dot * nx) * 0.7; // Apply friction dampening
                                b.vy = (b.vy - 2 * dot * ny) * 0.7;
                                
                                // Nudge away from line to prevent getting stuck
                                b.x += nx * 3;
                                b.y += ny * 3;
                                
                                if (window.game && audio.enabled) audio.playChop();
                            }
                        }
                    });

                    // Check cup capture
                    const cx = state.cup.x;
                    const cy = state.cup.y;
                    if (b.x > cx && b.x < cx + state.cup.w && b.y > cy && b.y < cy + state.cup.h) {
                        state.balls.splice(i, 1);
                        this.addScore(1);
                        if (window.game) audio.playPerfect(1);
                        continue;
                    }

                    // Delete dead balls
                    if (b.y > this.height + 20) {
                        state.balls.splice(i, 1);
                    }
                }
                break;
                
            case 'grow':
                // Smooth interpolation of player towards drag target
                const p = state.player;
                p.x += (p.targetX - p.x) * 0.1;
                p.y += (p.targetY - p.y) * 0.1;

                // Collide with food nodes
                for (let i = state.dots.length - 1; i >= 0; i--) {
                    const dot = state.dots[i];
                    const dx = p.x - dot.x;
                    const dy = p.y - dot.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < p.radius) {
                        state.dots.splice(i, 1);
                        p.radius = Math.min(80, p.radius + 1.2); // Grow player
                        this.addScore(1);
                        if (window.game) audio.playPerfect(2);
                        
                        // Spawn replacement food node
                        state.dots.push({
                            x: Math.random() * (this.width - 40) + 20,
                            y: Math.random() * (this.height - 40) + 20,
                            radius: 3,
                            color: `hsl(${Math.random() * 360}, 80%, 60%)`
                        });
                    }
                }
                break;
                
            case 'swerve':
                // Interpolate player X movement
                state.playerX += (state.targetPlayerX - state.playerX) * 0.15;

                // Handle obstacles / multiplier items
                state.spawnTimer += dt;
                if (state.spawnTimer > 1.0) {
                    state.spawnTimer = 0;
                    const typeSelect = Math.random();
                    let el = {
                        x: Math.random() * (this.width - 60) + 30,
                        y: -20,
                        w: 24,
                        h: 24
                    };

                    if (typeSelect < 0.45) {
                        el.type = 'gate-add';
                        el.val = 5;
                        el.color = varColor('--accent-green', '#10b981');
                    } else if (typeSelect < 0.65) {
                        el.type = 'gate-mul';
                        el.val = 2;
                        el.color = varColor('--accent-primary', '#6366f1');
                    } else {
                        el.type = 'spike';
                        el.color = varColor('--accent-red', '#ef4444');
                    }
                    state.elements.push(el);
                }

                for (let i = state.elements.length - 1; i >= 0; i--) {
                    const el = state.elements[i];
                    el.y += state.speed * dt;

                    // Collision bounds check
                    const px = state.playerX;
                    const py = this.height - 50;
                    const pw = 28;
                    const ph = 12;

                    if (el.y + el.h > py && el.y < py + ph && el.x + el.w > px - pw/2 && el.x < px + pw/2) {
                        // Impact registered!
                        state.elements.splice(i, 1);
                        
                        if (el.type === 'gate-add') {
                            this.addScore(el.val);
                            if (window.game) audio.playPerfect(5);
                        } else if (el.type === 'gate-mul') {
                            this.addScore(this.scores.swerve); // Double score
                            if (window.game) audio.playPerfect(7);
                        } else {
                            this.resetScore();
                            if (window.game) audio.playCrash();
                        }
                        continue;
                    }

                    // Prune items
                    if (el.y > this.height + 20) {
                        state.elements.splice(i, 1);
                    }
                }
                break;
                
            case 'destroy':
                // Update projectile ball physics
                const proj = state.projectile;
                if (proj) {
                    proj.x += proj.vx * dt;
                    proj.y += proj.vy * dt;

                    // Collision with wall blocks
                    state.blocks.forEach(b => {
                        if (b.active) {
                            if (proj.x + proj.radius > b.x && proj.x - proj.radius < b.x + b.w &&
                                proj.y + proj.radius > b.y && proj.y - proj.radius < b.y + b.h) {
                                
                                // Shatter block!
                                b.active = false;
                                this.addScore(1);
                                if (window.game) audio.playChop();

                                // Emit shattered block debris particles
                                for (let p = 0; p < 6; p++) {
                                    state.particles.push({
                                        x: b.x + b.w / 2,
                                        y: b.y + b.h / 2,
                                        vx: (Math.random() - 0.5) * 120,
                                        vy: (Math.random() - 0.5) * 120 - 40,
                                        size: Math.random() * 5 + 3,
                                        gravity: 300,
                                        color: b.color,
                                        life: 1.0,
                                        decay: Math.random() * 0.05 + 0.03
                                    });
                                }
                            }
                        }
                    });

                    // Remove projectile if outside canvas bounds
                    if (proj.y < -10 || proj.x < -10 || proj.x > this.width + 10) {
                        state.projectile = null;
                    }
                }

                // Update gravity particle system
                for (let i = state.particles.length - 1; i >= 0; i--) {
                    const p = state.particles[i];
                    p.vy += p.gravity * dt;
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.life -= p.decay;

                    if (p.life <= 0 || p.y > this.height + 10) {
                        state.particles.splice(i, 1);
                    }
                }
                break;
        }
    }

    render() {
        this.labCtx.clearRect(0, 0, this.width, this.height);
        const state = this.simState;

        switch (this.activeSimulator) {
            case 'tap':
                // Draw obstacles
                this.labCtx.fillStyle = varColor('--accent-primary', '#6366f1');
                state.obstacles.forEach(obs => {
                    // Top column
                    this.labCtx.fillRect(obs.x, 0, obs.w, obs.gapY);
                    // Bottom column
                    this.labCtx.fillRect(obs.x, obs.gapY + obs.gapH, obs.w, this.height);
                });

                // Draw ball
                const b = state.ball;
                this.labCtx.fillStyle = '#fff';
                this.labCtx.shadowBlur = 15;
                this.labCtx.shadowColor = 'rgba(255,255,255,0.4)';
                this.labCtx.beginPath();
                this.labCtx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                this.labCtx.fill();
                this.labCtx.shadowBlur = 0; // Reset
                break;
                
            case 'stack':
                // Render Stack grid projection in simple 2D view
                const centerX = this.width / 2;
                
                // Draw tower base block
                this.labCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                this.labCtx.fillRect(centerX - 60, 310, 120, 15);

                // Draw stable stack blocks
                state.blocks.forEach(blk => {
                    this.labCtx.fillStyle = blk.color;
                    this.labCtx.fillRect(centerX + blk.x, blk.z, blk.w, 15);
                    this.labCtx.strokeStyle = 'rgba(0,0,0,0.15)';
                    this.labCtx.strokeRect(centerX + blk.x, blk.z, blk.w, 15);
                });

                // Draw sliding active block
                if (!state.over) {
                    const act = state.active;
                    this.labCtx.fillStyle = act.color;
                    this.labCtx.fillRect(centerX + act.x, act.z, act.w, 15);
                    this.labCtx.strokeRect(centerX + act.x, act.z, act.w, 15);
                }

                // Draw falling sliced chunks
                state.debris.forEach(deb => {
                    this.labCtx.fillStyle = deb.color;
                    this.labCtx.fillRect(centerX + deb.x, deb.z, deb.w, 15);
                });
                break;
                
            case 'timing':
                const cx = this.width / 2;
                const cy = this.height / 2 - 20;
                const r = 80;

                // Draw spinning target wheel
                this.labCtx.save();
                this.labCtx.translate(cx, cy);
                this.labCtx.rotate(state.wheelAngle);
                
                // Red bad sectors background
                this.labCtx.fillStyle = varColor('--accent-red', '#ef4444');
                this.labCtx.beginPath();
                this.labCtx.arc(0, 0, r, 0, Math.PI * 2);
                this.labCtx.fill();

                // Green sector
                this.labCtx.fillStyle = varColor('--accent-green', '#10b981');
                this.labCtx.beginPath();
                this.labCtx.moveTo(0,0);
                this.labCtx.arc(0, 0, r, state.targetSector.start, state.targetSector.end);
                this.labCtx.closePath();
                this.labCtx.fill();

                // Center wheel cap
                this.labCtx.fillStyle = '#0f0d1e';
                this.labCtx.beginPath();
                this.labCtx.arc(0, 0, 15, 0, Math.PI * 2);
                this.labCtx.fill();
                this.labCtx.restore();

                // Draw scanning needle (unrotated)
                this.labCtx.save();
                this.labCtx.translate(cx, cy);
                this.labCtx.rotate(state.needleAngle);
                
                this.labCtx.strokeStyle = '#fff';
                this.labCtx.lineWidth = 3;
                this.labCtx.beginPath();
                this.labCtx.moveTo(0, 0);
                this.labCtx.lineTo(r - 5, 0);
                this.labCtx.stroke();
                
                this.labCtx.fillStyle = '#fff';
                this.labCtx.beginPath();
                this.labCtx.arc(r - 2, 0, 4, 0, Math.PI * 2);
                this.labCtx.fill();
                this.labCtx.restore();
                break;
                
            case 'puzzle':
                // Draw lines
                this.labCtx.strokeStyle = varColor('--accent-secondary', '#a855f7');
                this.labCtx.lineWidth = 5;
                this.labCtx.lineCap = 'round';
                this.labCtx.lineJoin = 'round';

                state.lines.forEach(line => {
                    this.labCtx.beginPath();
                    this.labCtx.moveTo(line[0].x, line[0].y);
                    for (let i = 1; i < line.length; i++) {
                        this.labCtx.lineTo(line[i].x, line[i].y);
                    }
                    this.labCtx.stroke();
                });

                // Draw currently active drawing line
                if (state.activeLine && state.activeLine.length > 1) {
                    this.labCtx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
                    this.labCtx.beginPath();
                    this.labCtx.moveTo(state.activeLine[0].x, state.activeLine[0].y);
                    for (let i = 1; i < state.activeLine.length; i++) {
                        this.labCtx.lineTo(state.activeLine[i].x, state.activeLine[i].y);
                    }
                    this.labCtx.stroke();
                }

                // Draw falling balls
                this.labCtx.fillStyle = '#fff';
                state.balls.forEach(b => {
                    this.labCtx.beginPath();
                    this.labCtx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                    this.labCtx.fill();
                });

                // Draw target container glass cup
                const cup = state.cup;
                this.labCtx.fillStyle = 'rgba(99, 102, 241, 0.15)';
                this.labCtx.strokeStyle = varColor('--accent-primary', '#6366f1');
                this.labCtx.lineWidth = 3;
                
                this.labCtx.beginPath();
                this.labCtx.moveTo(cup.x, cup.y);
                this.labCtx.lineTo(cup.x, cup.y + cup.h);
                this.labCtx.lineTo(cup.x + cup.w, cup.y + cup.h);
                this.labCtx.lineTo(cup.x + cup.w, cup.y);
                this.labCtx.stroke();
                this.labCtx.fill();
                break;
                
            case 'grow':
                // Draw food dots
                state.dots.forEach(dot => {
                    this.labCtx.fillStyle = dot.color;
                    this.labCtx.beginPath();
                    this.labCtx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
                    this.labCtx.fill();
                });

                // Draw player circle
                const ply = state.player;
                this.labCtx.fillStyle = varColor('--accent-secondary', '#a855f7');
                this.labCtx.shadowBlur = ply.radius * 0.8;
                this.labCtx.shadowColor = 'rgba(168, 85, 247, 0.6)';
                
                this.labCtx.beginPath();
                this.labCtx.arc(ply.x, ply.y, ply.radius, 0, Math.PI * 2);
                this.labCtx.fill();
                this.labCtx.shadowBlur = 0; // Reset
                break;
                
            case 'swerve':
                // Draw 3 lanes guide lines
                this.labCtx.strokeStyle = 'rgba(255,255,255,0.03)';
                this.labCtx.lineWidth = 1;
                this.labCtx.setLineDash([5, 5]);
                
                const thirds = this.width / 3;
                this.labCtx.beginPath();
                this.labCtx.moveTo(thirds, 0); this.labCtx.lineTo(thirds, this.height);
                this.labCtx.moveTo(thirds*2, 0); this.labCtx.lineTo(thirds*2, this.height);
                this.labCtx.stroke();
                this.labCtx.setLineDash([]); // Reset

                // Draw gates/hazards
                state.elements.forEach(el => {
                    this.labCtx.fillStyle = el.color;
                    this.labCtx.fillRect(el.x, el.y, el.w, el.h);
                    
                    // Draw math gate texts
                    if (el.type === 'gate-add') {
                        this.labCtx.fillStyle = '#000';
                        this.labCtx.font = '800 10px Outfit';
                        this.labCtx.fillText(`+${el.val}`, el.x + 5, el.y + 16);
                    } else if (el.type === 'gate-mul') {
                        this.labCtx.fillStyle = '#fff';
                        this.labCtx.font = '800 10px Outfit';
                        this.labCtx.fillText(`X${el.val}`, el.x + 5, el.y + 16);
                    }
                });

                // Draw player slider
                this.labCtx.fillStyle = '#fff';
                this.labCtx.fillRect(state.playerX - 14, this.height - 50, 28, 12);
                break;
                
            case 'destroy':
                // Draw bricks wall
                state.blocks.forEach(b => {
                    if (b.active) {
                        this.labCtx.fillStyle = b.color;
                        this.labCtx.fillRect(b.x, b.y, b.w, b.h);
                        this.labCtx.strokeStyle = 'rgba(0,0,0,0.2)';
                        this.labCtx.strokeRect(b.x, b.y, b.w, b.h);
                    }
                });

                // Draw active projectile demolition ball
                if (state.projectile) {
                    this.labCtx.fillStyle = '#fff';
                    this.labCtx.beginPath();
                    this.labCtx.arc(state.projectile.x, state.projectile.y, state.projectile.radius, 0, Math.PI * 2);
                    this.labCtx.fill();
                }

                // Draw gravity debris shards
                state.particles.forEach(p => {
                    this.labCtx.fillStyle = p.color;
                    this.labCtx.globalAlpha = p.life;
                    this.labCtx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
                });
                this.labCtx.globalAlpha = 1.0; // Reset
                break;
        }
    }

    // Mathematical utility: Distance from point to line segment
    distToSegment(p, v, w) {
        const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
        if (l2 === 0) return Math.sqrt((p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y));
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const px = v.x + t * (w.x - v.x);
        const py = v.y + t * (w.y - v.y);
        return Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (dt > 0.1) dt = 0.1;

        // Skip simulation loops if viewing the full stack arcade tab (optimization)
        const activeNav = document.querySelector('.nav-item.active');
        const isArcade = activeNav && activeNav.getAttribute('data-target') === 'arcade';

        if (!isArcade) {
            this.update(dt);
            this.render();
        }

        requestAnimationFrame((t) => this.loop(t));
    }
}

// Utility functions to resolve CSS variables in Canvas
function varColor(cssName, fallback) {
    const computed = getComputedStyle(document.documentElement).getPropertyValue(cssName);
    return computed ? computed.trim() : fallback;
}

// Static values
const BLOCK_HEIGHT = 15;

// Instantiate Portal Controller on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    window.portal = new MasterclassPortal();
});
