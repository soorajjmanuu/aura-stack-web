/* ==========================================================================
   AURA STACK - GAME ENGINE
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. GAME CONSTANTS & STATE
// --------------------------------------------------------------------------
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 800;
const ISO_X = 0.866; // cos(30 degrees)
const ISO_Y = 0.5;   // sin(30 degrees)
const BLOCK_HEIGHT = 16;
const ORIGINAL_SIZE = 160; // Starting width and depth of the tower
const PERFECT_LIMIT = 5;   // Max alignment offset (in pixels) for a "Perfect" snap
const CAMERA_LERP = 0.08;  // Speed of camera interpolation
const SPEED_INCREMENT = 0.08; // Acceleration per level

// Color Themes Registry
const THEMES = [
    {
        id: 'neon-aura',
        name: 'Neon Aura',
        cost: 0,
        startHue: 240,
        hueShift: 4,
        saturation: 75,
        lightness: 50,
        glow1: '#6366f1',
        glow2: '#a855f7'
    },
    {
        id: 'cyber-punk',
        name: 'Cyber Punk',
        cost: 100,
        startHue: 320,
        hueShift: -6,
        saturation: 85,
        lightness: 55,
        glow1: '#ec4899',
        glow2: '#06b6d4'
    },
    {
        id: 'forest-zen',
        name: 'Forest Zen',
        cost: 200,
        startHue: 140,
        hueShift: 5,
        saturation: 65,
        lightness: 45,
        glow1: '#10b981',
        glow2: '#84cc16'
    },
    {
        id: 'sunset-blvd',
        name: 'Sunset Blvd',
        cost: 350,
        startHue: 20,
        hueShift: 6,
        saturation: 80,
        lightness: 55,
        glow1: '#f97316',
        glow2: '#eab308'
    },
    {
        id: 'deep-space',
        name: 'Deep Space',
        cost: 500,
        startHue: 275,
        hueShift: -4,
        saturation: 75,
        lightness: 48,
        glow1: '#4f46e5',
        glow2: '#1d4ed8'
    }
];

// Audio System using Web Audio API
const audio = {
    ctx: null,
    enabled: true,
    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    playPerfect(streak) {
        if (!this.enabled) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const now = this.ctx.currentTime;
        
        // Pentatonic major scale (C major pentatonic) starting at C4
        const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        const noteIndex = Math.min(streak, scale.length - 1);
        const freq = scale[noteIndex];
        
        // Lead tone (Chime)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.start(now);
        osc1.stop(now + 0.45);
        
        // Warm sub-harmony
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq / 2, now);
        gain2.gain.setValueAtTime(0.15, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.start(now);
        osc2.stop(now + 0.35);
    },
    playChop() {
        if (!this.enabled) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.12);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
        
        osc.start(now);
        osc.stop(now + 0.15);
    },
    playCrash() {
        if (!this.enabled) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.5);
        
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        osc.start(now);
        osc.stop(now + 0.55);
    }
};

// --------------------------------------------------------------------------
// 2. STATE MANAGER & INITIALIZATION
// --------------------------------------------------------------------------
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Scale Canvas for Retina/High-DPI displays
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Game Settings and Storage
        this.highScore = parseInt(localStorage.getItem('stack_highScore')) || 0;
        this.coins = parseInt(localStorage.getItem('stack_coins')) || 0;
        this.activeThemeIndex = parseInt(localStorage.getItem('stack_activeTheme')) || 0;
        this.unlockedThemes = JSON.parse(localStorage.getItem('stack_unlockedThemes')) || ['neon-aura'];
        
        audio.enabled = (localStorage.getItem('stack_soundEnabled') !== 'false');

        // Dynamic State Variables
        this.state = 'MENU'; // MENU, PLAYING, REVIVE_PROMPT, GAME_OVER, SHOP
        this.stack = [];     // Locked stack blocks
        this.debris = [];    // Physics debris pieces
        this.particles = []; // Decorative visual effects
        
        this.activeBlock = null;
        this.level = 0;
        this.cameraY = 0;
        this.targetCameraY = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        
        // Stats for current run
        this.score = 0;
        this.coinsEarned = 0;
        this.perfectStreak = 0;
        this.hasRevived = false;

        // Revive Countdown Timer
        this.reviveCountdownVal = 5;
        this.reviveTimer = null;

        // UI Hookups
        this.initUI();

        // Start core game rendering loop
        this.lastTime = 0;
        requestAnimationFrame((t) => this.loop(t));
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.canvasScaleX = rect.width;
        this.canvasScaleY = rect.height;
    }

    initUI() {
        // Overlay Screens
        this.menuScreen = document.getElementById('menuScreen');
        this.reviveScreen = document.getElementById('reviveScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.shopScreen = document.getElementById('shopScreen');
        this.adSimulator = document.getElementById('adSimulator');
        this.hud = document.getElementById('hud');

        // Values
        document.getElementById('menuBestScore').innerText = this.highScore;
        document.getElementById('hudCoins').innerText = this.coins;
        this.updateSoundButtonUI();

        // Button Controls
        document.getElementById('btnPlay').addEventListener('click', () => this.startGame());
        document.getElementById('btnShop').addEventListener('click', () => this.openShop());
        document.getElementById('btnCloseShop').addEventListener('click', () => this.closeShop());
        document.getElementById('btnRestart').addEventListener('click', () => this.startGame());
        document.getElementById('btnBackToMenu').addEventListener('click', () => this.goToMenu());
        
        document.getElementById('btnToggleSound').addEventListener('click', () => {
            audio.enabled = !audio.enabled;
            localStorage.setItem('stack_soundEnabled', audio.enabled);
            this.updateSoundButtonUI();
            audio.init();
        });

        // Revive flow
        document.getElementById('btnWatchAd').addEventListener('click', () => this.watchRewardedAd('revive'));
        document.getElementById('btnSkipRevive').addEventListener('click', () => this.skipRevive());

        // Game Over double coins flow
        document.getElementById('btnDoubleCoins').addEventListener('click', () => this.watchRewardedAd('double'));

        // Main Tap Input on Canvas
        this.canvas.addEventListener('mousedown', (e) => this.handleTap(e));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTap(e);
        });

        // Keyboard support (Space to play/stack)
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleTap(e);
            }
        });
    }

    updateSoundButtonUI() {
        const iconOn = document.getElementById('soundIconOn');
        const iconOff = document.getElementById('soundIconOff');
        const soundText = document.getElementById('soundText');
        
        if (audio.enabled) {
            iconOn.classList.remove('hidden');
            iconOff.classList.add('hidden');
            soundText.innerText = "SOUND ON";
        } else {
            iconOn.classList.add('hidden');
            iconOff.classList.remove('hidden');
            soundText.innerText = "SOUND OFF";
        }
    }

    // --------------------------------------------------------------------------
    // 3. THE CORE GAME LOOPS & ACTION TRIGGERS
    // --------------------------------------------------------------------------
    startGame() {
        audio.init();
        this.state = 'PLAYING';
        this.stack = [];
        this.debris = [];
        this.particles = [];
        this.level = 0;
        this.score = 0;
        this.coinsEarned = 0;
        this.perfectStreak = 0;
        this.hasRevived = false;
        
        this.cameraY = 0;
        this.targetCameraY = 0;
        
        // Spawn Base Stack Block
        this.stack.push({
            x: 0,
            y: 0,
            z: BLOCK_HEIGHT / 2,
            w: ORIGINAL_SIZE,
            d: ORIGINAL_SIZE,
            h: BLOCK_HEIGHT,
            color: this.getBlockColor(0)
        });

        // Spawn First Active Sliding Block
        this.spawnBlock();

        // Update UI
        this.hud.classList.remove('hidden');
        document.getElementById('currentScore').innerText = '0';
        document.getElementById('streakBadge').classList.add('hidden');
        
        this.hideAllScreens();
        this.updateGlowBackdrops();
    }

    spawnBlock() {
        this.level++;
        
        // Alternate axes of movement
        const axis = this.level % 2 === 0 ? 'y' : 'x';
        
        // Reference block directly beneath
        const baseBlock = this.stack[this.stack.length - 1];
        
        // Dimensions match the base block width/depth
        const w = baseBlock.w;
        const d = baseBlock.d;
        const h = BLOCK_HEIGHT;
        const z = baseBlock.z + BLOCK_HEIGHT;
        
        // Slide parameters
        const slideRange = 260; // Distance from center where block starts sliding
        const speed = 120 + this.level * SPEED_INCREMENT; // Scale speed as level increases
        
        this.activeBlock = {
            x: axis === 'x' ? -slideRange : baseBlock.x,
            y: axis === 'y' ? -slideRange : baseBlock.y,
            z: z,
            w: w,
            d: d,
            h: h,
            axis: axis,
            speed: speed,
            direction: 1,
            color: this.getBlockColor(this.level)
        };
        
        // Pan camera upwards to match tower top
        if (this.level > 2) {
            this.targetCameraY = (this.level - 2) * BLOCK_HEIGHT;
        }
    }

    handleTap(e) {
        if (this.state === 'MENU') {
            this.startGame();
        } else if (this.state === 'PLAYING') {
            this.sliceBlock();
        }
    }

    sliceBlock() {
        const active = this.activeBlock;
        const base = this.stack[this.stack.length - 1];
        const axis = active.axis;
        
        let overlapOffset = 0;
        let diff = 0;
        let isPerfect = false;

        if (axis === 'x') {
            diff = active.x - base.x;
            overlapOffset = Math.abs(diff);
            
            if (overlapOffset < PERFECT_LIMIT) {
                isPerfect = true;
                active.x = base.x;
                diff = 0;
            }
        } else {
            diff = active.y - base.y;
            overlapOffset = Math.abs(diff);
            
            if (overlapOffset < PERFECT_LIMIT) {
                isPerfect = true;
                active.y = base.y;
                diff = 0;
            }
        }

        // 1. PERFECT SNAP MATCH
        if (isPerfect) {
            this.perfectStreak++;
            this.score++;
            
            // Collect coins: +1 coin base, scaling bonus for streaks
            const bonusCoins = 1 + Math.floor(this.perfectStreak / 3);
            this.addCoins(bonusCoins);
            
            audio.playPerfect(this.perfectStreak);
            
            // Add a perfect snap ripple particle
            this.createRippleParticle(active.x, active.y, active.z, active.w, active.d);
            
            // Dynamic progression helper: if user gets a perfect streak, rebuild lost block width slightly
            if (this.perfectStreak >= 5) {
                const growth = 8;
                if (axis === 'x') {
                    active.w = Math.min(ORIGINAL_SIZE, active.w + growth);
                } else {
                    active.d = Math.min(ORIGINAL_SIZE, active.d + growth);
                }
                this.createSparkParticles(active.x, active.y, active.z, '#FFD700', 30);
            } else {
                this.createSparkParticles(active.x, active.y, active.z, '#ffffff', 12);
            }

            // Move block into stacked elements
            this.stack.push({
                x: active.x,
                y: active.y,
                z: active.z,
                w: active.w,
                d: active.d,
                h: active.h,
                color: active.color
            });

            this.updateHUD();
            this.spawnBlock();
        } 
        // 2. COMPLETE MISS (GAME OVER / REVIVE TRIGGER)
        else if (overlapOffset >= (axis === 'x' ? active.w : active.d)) {
            // Screen shake
            this.triggerScreenShake(12, 0.4);
            audio.playCrash();

            // Spawn whole block as debris falling down
            this.spawnDebris(active.x, active.y, active.z, active.w, active.d, active.h, active.color, axis, diff);
            
            this.activeBlock = null;
            this.handleFail();
        } 
        // 3. CHOPPED SUCCESS OVERLAP
        else {
            this.perfectStreak = 0;
            this.score++;
            this.addCoins(1);
            
            audio.playChop();

            let placedW = active.w;
            let placedD = active.d;
            let placedX = active.x;
            let placedY = active.y;

            let debrisW = 0;
            let debrisD = 0;
            let debrisX = 0;
            let debrisY = 0;

            if (axis === 'x') {
                placedW = active.w - overlapOffset;
                placedX = base.x + diff / 2;
                
                debrisW = overlapOffset;
                debrisX = placedX + Math.sign(diff) * (active.w / 2);
                debrisY = active.y;
                debrisD = active.d;
            } else {
                placedD = active.d - overlapOffset;
                placedY = base.y + diff / 2;
                
                debrisD = overlapOffset;
                debrisY = placedY + Math.sign(diff) * (active.d / 2);
                debrisX = active.x;
                debrisW = active.w;
            }

            // Spawn Debris block
            this.spawnDebris(debrisX, debrisY, active.z, debrisW, debrisD, active.h, active.color, axis, diff);

            // Add sliced block to stable stack
            this.stack.push({
                x: placedX,
                y: placedY,
                z: active.z,
                w: placedW,
                d: placedD,
                h: active.h,
                color: active.color
            });

            this.updateHUD();
            this.spawnBlock();
        }
    }

    handleFail() {
        if (!this.hasRevived && this.score >= 5) {
            // Offer Revive Option
            this.state = 'REVIVE_PROMPT';
            this.hud.classList.add('hidden');
            this.showScreen(this.reviveScreen);
            this.startReviveCountdown();
        } else {
            this.triggerGameOver();
        }
    }

    // --------------------------------------------------------------------------
    // 4. REVIVE & AD SIMULATION FLOW
    // --------------------------------------------------------------------------
    startReviveCountdown() {
        this.reviveCountdownVal = 5;
        const countdownText = document.getElementById('countdownText');
        const countdownBar = document.getElementById('countdownBar');
        
        countdownText.innerText = this.reviveCountdownVal;
        countdownBar.style.strokeDashoffset = '0';
        
        if (this.reviveTimer) clearInterval(this.reviveTimer);
        
        const totalDuration = 5000;
        let elapsed = 0;

        this.reviveTimer = setInterval(() => {
            elapsed += 100;
            const remaining = Math.max(0, 5 - Math.floor(elapsed / 1000));
            countdownText.innerText = remaining;
            
            // Adjust SVG stroke dash offset: circumference is 283
            const pct = elapsed / totalDuration;
            countdownBar.style.strokeDashoffset = (283 * pct).toFixed(1);

            if (elapsed >= totalDuration) {
                clearInterval(this.reviveTimer);
                this.skipRevive();
            }
        }, 100);
    }

    skipRevive() {
        if (this.reviveTimer) clearInterval(this.reviveTimer);
        this.triggerGameOver();
    }

    watchRewardedAd(type) {
        if (this.reviveTimer) clearInterval(this.reviveTimer);
        
        this.hideAllScreens();
        this.adSimulator.classList.remove('hidden');
        
        const adTimer = document.getElementById('adTimer');
        const btnSkipAd = document.getElementById('btnSkipAd');
        
        let elapsed = 3;
        adTimer.innerText = `${elapsed}s`;
        btnSkipAd.innerText = `SKIP AD IN ${elapsed}S`;
        btnSkipAd.classList.add('disabled');
        btnSkipAd.disabled = true;

        const timer = setInterval(() => {
            elapsed--;
            adTimer.innerText = `${elapsed}s`;
            btnSkipAd.innerText = `SKIP AD IN ${elapsed}S`;

            if (elapsed <= 0) {
                clearInterval(timer);
                adTimer.innerText = `REWARD UNLOCKED`;
                btnSkipAd.innerText = `CLOSE AD & COLLECT`;
                btnSkipAd.classList.remove('disabled');
                btnSkipAd.disabled = false;
                
                // Allow player to close and fetch reward
                btnSkipAd.onclick = () => {
                    this.adSimulator.classList.add('hidden');
                    if (type === 'revive') {
                        this.grantRevive();
                    } else if (type === 'double') {
                        this.grantDoubleCoins();
                    }
                };
            }
        }, 1000);
    }

    grantRevive() {
        this.hasRevived = true;
        this.state = 'PLAYING';
        this.hud.classList.remove('hidden');
        
        // Reinstate the block to top tower size
        const base = this.stack[this.stack.length - 1];
        
        // Spawn active block centered above it
        const axis = this.level % 2 === 0 ? 'y' : 'x';
        this.activeBlock = {
            x: axis === 'x' ? -260 : base.x,
            y: axis === 'y' ? -260 : base.y,
            z: base.z + BLOCK_HEIGHT,
            w: base.w,
            d: base.d,
            h: BLOCK_HEIGHT,
            axis: axis,
            speed: 120 + this.level * SPEED_INCREMENT,
            direction: 1,
            color: this.getBlockColor(this.level)
        };
        
        this.updateHUD();
    }

    grantDoubleCoins() {
        this.coins += this.coinsEarned; // Add another batch of coins
        this.coinsEarned *= 2;
        localStorage.setItem('stack_coins', this.coins);
        
        document.getElementById('endEarnedCoins').innerText = this.coinsEarned;
        document.getElementById('hudCoins').innerText = this.coins;
        
        const btnDouble = document.getElementById('btnDoubleCoins');
        btnDouble.classList.add('hidden'); // Disable and hide double offer
    }

    triggerGameOver() {
        this.state = 'GAME_OVER';
        this.hud.classList.add('hidden');
        
        // Calculate high score
        let newBest = false;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('stack_highScore', this.highScore);
            newBest = true;
        }

        // Commit total coins
        this.coins += this.coinsEarned;
        localStorage.setItem('stack_coins', this.coins);

        // Update game-over screen texts
        document.getElementById('endScore').innerText = this.score;
        document.getElementById('endBestScore').innerText = this.highScore;
        document.getElementById('endEarnedCoins').innerText = this.coinsEarned;
        document.getElementById('hudCoins').innerText = this.coins;
        
        const btnDouble = document.getElementById('btnDoubleCoins');
        if (this.coinsEarned > 0) {
            btnDouble.classList.remove('hidden');
        } else {
            btnDouble.classList.add('hidden');
        }

        this.showScreen(this.gameOverScreen);
    }

    goToMenu() {
        this.state = 'MENU';
        this.hud.classList.add('hidden');
        
        document.getElementById('menuBestScore').innerText = this.highScore;
        document.getElementById('hudCoins').innerText = this.coins;
        
        this.showScreen(this.menuScreen);
        this.updateGlowBackdrops();
    }

    // --------------------------------------------------------------------------
    // 5. ECONOMY & SHOP CONTROLS
    // --------------------------------------------------------------------------
    openShop() {
        this.state = 'SHOP';
        document.getElementById('shopCoins').innerText = this.coins;
        this.renderShopItems();
        this.showScreen(this.shopScreen);
    }

    closeShop() {
        if (this.state === 'SHOP') {
            this.goToMenu();
        }
    }

    renderShopItems() {
        const container = document.getElementById('themesContainer');
        container.innerHTML = ''; // Clean slate

        THEMES.forEach((theme, index) => {
            const unlocked = this.unlockedThemes.includes(theme.id);
            const active = this.activeThemeIndex === index;
            
            const item = document.createElement('div');
            item.className = `theme-item ${active ? 'active' : ''}`;
            
            // Build visual representation of the theme's colors
            const previewColors = [];
            for (let i = 0; i < 3; i++) {
                const hue = theme.startHue + (i * 15) * theme.hueShift;
                previewColors.push(`hsl(${hue % 360}, ${theme.saturation}%, ${theme.lightness}%)`);
            }

            let actionHTML = '';
            if (active) {
                actionHTML = `<span class="theme-action text-active">Equipped</span>`;
            } else if (unlocked) {
                actionHTML = `<span class="theme-action text-equip">Equip</span>`;
            } else {
                actionHTML = `
                    <button class="theme-action btn-buy" data-index="${index}">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                            <circle cx="12" cy="12" r="10"/>
                        </svg>
                        <span>${theme.cost}</span>
                    </button>`;
            }

            item.innerHTML = `
                <div class="theme-info">
                    <span class="theme-name">${theme.name}</span>
                    <div class="theme-preview">
                        <div class="color-dot" style="background-color: ${previewColors[0]}"></div>
                        <div class="color-dot" style="background-color: ${previewColors[1]}"></div>
                        <div class="color-dot" style="background-color: ${previewColors[2]}"></div>
                    </div>
                </div>
                ${actionHTML}
            `;

            // Event bindings
            if (!active) {
                item.addEventListener('click', (e) => {
                    const buyBtn = item.querySelector('.btn-buy');
                    if (buyBtn && e.target.closest('.btn-buy')) {
                        this.buyTheme(index);
                    } else if (unlocked) {
                        this.equipTheme(index);
                    }
                });
            }

            container.appendChild(item);
        });
    }

    buyTheme(index) {
        const theme = THEMES[index];
        if (this.coins >= theme.cost) {
            this.coins -= theme.cost;
            this.unlockedThemes.push(theme.id);
            
            localStorage.setItem('stack_coins', this.coins);
            localStorage.setItem('stack_unlockedThemes', JSON.stringify(this.unlockedThemes));
            
            document.getElementById('shopCoins').innerText = this.coins;
            
            this.equipTheme(index);
        } else {
            // Flash red on coins wallet to signify insufficient funds
            const wallet = document.querySelector('.shop-wallet');
            wallet.style.borderColor = '#ef4444';
            wallet.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            setTimeout(() => {
                wallet.style.borderColor = 'rgba(255, 255, 255, 0.02)';
                wallet.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            }, 500);
        }
    }

    equipTheme(index) {
        this.activeThemeIndex = index;
        localStorage.setItem('stack_activeTheme', this.activeThemeIndex);
        this.renderShopItems();
        this.updateGlowBackdrops();
    }

    updateGlowBackdrops() {
        const theme = THEMES[this.activeThemeIndex];
        const glow1 = document.querySelector('.glow-1');
        const glow2 = document.querySelector('.glow-2');
        
        glow1.style.background = `radial-gradient(circle, ${theme.glow1} 0%, rgba(99, 102, 241, 0) 70%)`;
        glow2.style.background = `radial-gradient(circle, ${theme.glow2} 0%, rgba(168, 85, 247, 0) 70%)`;
    }

    // --------------------------------------------------------------------------
    // 6. UTILITIES, PARTICLES & DEBRIS PHYSICS
    // --------------------------------------------------------------------------
    addCoins(amount) {
        this.coinsEarned += amount;
    }

    updateHUD() {
        const currentScore = document.getElementById('currentScore');
        currentScore.innerText = this.score;
        currentScore.classList.remove('animate-pop');
        void currentScore.offsetWidth; // Trigger reflow for CSS keyframes
        currentScore.classList.add('animate-pop');

        const streakBadge = document.getElementById('streakBadge');
        if (this.perfectStreak > 0) {
            document.getElementById('streakCount').innerText = this.perfectStreak;
            streakBadge.classList.remove('hidden');
        } else {
            streakBadge.classList.add('hidden');
        }
    }

    getBlockColor(levelValue) {
        const theme = THEMES[this.activeThemeIndex];
        const hue = theme.startHue + levelValue * theme.hueShift;
        return {
            h: hue % 360,
            s: theme.saturation,
            l: theme.lightness
        };
    }

    spawnDebris(x, y, z, w, d, h, color, axis, diff) {
        const dragSpeed = 2.5;
        this.debris.push({
            x: x,
            y: y,
            z: z,
            w: w,
            d: d,
            h: h,
            color: color,
            vx: axis === 'x' ? Math.sign(diff) * dragSpeed : 0,
            vy: axis === 'y' ? Math.sign(diff) * dragSpeed : 0,
            vz: 0,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
            vrotX: axis === 'y' ? -Math.sign(diff) * 0.08 : (Math.random() - 0.5) * 0.02,
            vrotY: axis === 'x' ? Math.sign(diff) * 0.08 : (Math.random() - 0.5) * 0.02,
            vrotZ: (Math.random() - 0.5) * 0.04
        });
    }

    createRippleParticle(x, y, z, w, d) {
        const theme = THEMES[this.activeThemeIndex];
        this.particles.push({
            type: 'ripple',
            x: x,
            y: y,
            z: z,
            size: Math.max(w, d) / 2,
            maxSize: Math.max(w, d) * 1.6,
            life: 1.0,
            decay: 0.04,
            color: theme.glow1
        });
    }

    createSparkParticles(x, y, z, colorStr, amount) {
        for (let i = 0; i < amount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 50;
            this.particles.push({
                type: 'spark',
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                z: z + 2,
                size: Math.random() * 3 + 1,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                vz: Math.random() * 4 + 2,
                life: 1.0,
                decay: Math.random() * 0.03 + 0.02,
                color: colorStr
            });
        }
    }

    triggerScreenShake(intensity, durationSeconds) {
        this.shakeIntensity = intensity;
        this.shakeTimer = durationSeconds;
    }

    hideAllScreens() {
        this.menuScreen.classList.add('hidden');
        this.reviveScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.shopScreen.classList.add('hidden');
        this.adSimulator.classList.add('hidden');
    }

    showScreen(screenElement) {
        this.hideAllScreens();
        screenElement.classList.remove('hidden');
        screenElement.classList.add('active');
    }

    // --------------------------------------------------------------------------
    // 7. RENDERING SYSTEM (ISOMETRIC 2D CANVAS)
    // --------------------------------------------------------------------------
    toScreenSpace(x, y, z) {
        // Center alignment offset
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT * 0.65;
        
        const screenX = centerX + (x - y) * ISO_X;
        const screenY = centerY + (x + y) * ISO_Y - z + this.cameraY;
        
        return { x: screenX, y: screenY };
    }

    drawBlock(block, isDebris = false, debrisRot = null) {
        const { x, y, z, w, d, h, color } = block;
        const baseColorStr = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
        const leftColorStr = `hsl(${color.h}, ${color.s}%, ${color.l - 12}%)`;
        const rightColorStr = `hsl(${color.h}, ${color.s}%, ${color.l - 24}%)`;

        // Coordinate calculations
        const hw = w / 2;
        const hd = d / 2;

        let pFront, pLeft, pRight, pBack, pFrontBottom, pLeftBottom, pRightBottom;

        if (isDebris && debrisRot) {
            // For debris falling, apply rotational offsets in isometric space for dynamic look
            const rotX = debrisRot.x;
            const rotY = debrisRot.y;
            
            const rotateVec = (vx, vy) => {
                const rx = vx * Math.cos(rotY) - vy * Math.sin(rotY);
                const ry = vx * Math.sin(rotX) + vy * Math.cos(rotX);
                return { x: rx, y: ry };
            };

            const f = rotateVec(hw, hd);
            const l = rotateVec(-hw, hd);
            const b = rotateVec(-hw, -hd);
            const r = rotateVec(hw, -hd);

            pFront = this.toScreenSpace(x + f.x, y + f.y, z);
            pLeft = this.toScreenSpace(x + l.x, y + l.y, z);
            pBack = this.toScreenSpace(x + b.x, y + b.y, z);
            pRight = this.toScreenSpace(x + r.x, y + r.y, z);

            pFrontBottom = this.toScreenSpace(x + f.x, y + f.y, z - h);
            pLeftBottom = this.toScreenSpace(x + l.x, y + l.y, z - h);
            pRightBottom = this.toScreenSpace(x + r.x, y + r.y, z - h);
        } else {
            pFront = this.toScreenSpace(x + hw, y + hd, z);
            pLeft = this.toScreenSpace(x - hw, y + hd, z);
            pBack = this.toScreenSpace(x - hw, y - hd, z);
            pRight = this.toScreenSpace(x + hw, y - hd, z);

            pFrontBottom = this.toScreenSpace(x + hw, y + hd, z - h);
            pLeftBottom = this.toScreenSpace(x - hw, y + hd, z - h);
            pRightBottom = this.toScreenSpace(x + hw, y - hd, z - h);
        }

        // Draw Left Face
        this.ctx.fillStyle = leftColorStr;
        this.ctx.beginPath();
        this.ctx.moveTo(pLeft.x, pLeft.y);
        this.ctx.lineTo(pFront.x, pFront.y);
        this.ctx.lineTo(pFrontBottom.x, pFrontBottom.y);
        this.ctx.lineTo(pLeftBottom.x, pLeftBottom.y);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw Right Face
        this.ctx.fillStyle = rightColorStr;
        this.ctx.beginPath();
        this.ctx.moveTo(pFront.x, pFront.y);
        this.ctx.lineTo(pRight.x, pRight.y);
        this.ctx.lineTo(pRightBottom.x, pRightBottom.y);
        this.ctx.lineTo(pFrontBottom.x, pFrontBottom.y);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw Top Face
        this.ctx.fillStyle = baseColorStr;
        this.ctx.beginPath();
        this.ctx.moveTo(pFront.x, pFront.y);
        this.ctx.lineTo(pRight.x, pRight.y);
        this.ctx.lineTo(pBack.x, pBack.y);
        this.ctx.lineTo(pLeft.x, pLeft.y);
        this.ctx.closePath();
        this.ctx.fill();
    }

    // --------------------------------------------------------------------------
    // 8. UPDATE AND LOOP CONTROLS
    // --------------------------------------------------------------------------
    update(dt) {
        // Screen Shake resolution
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            if (this.shakeTimer <= 0) {
                this.shakeIntensity = 0;
            }
        }

        // Smooth camera panning
        this.cameraY += (this.targetCameraY - this.cameraY) * CAMERA_LERP;

        // Slide the active active block
        if (this.state === 'PLAYING' && this.activeBlock) {
            const ab = this.activeBlock;
            const range = 260;
            
            if (ab.axis === 'x') {
                ab.x += ab.speed * ab.direction * dt;
                if (ab.x > range) {
                    ab.x = range;
                    ab.direction = -1;
                } else if (ab.x < -range) {
                    ab.x = -range;
                    ab.direction = 1;
                }
            } else {
                ab.y += ab.speed * ab.direction * dt;
                if (ab.y > range) {
                    ab.y = range;
                    ab.direction = -1;
                } else if (ab.y < -range) {
                    ab.y = -range;
                    ab.direction = 1;
                }
            }
        }

        // Resolve debris physics (gravity + rotation + velocity)
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const deb = this.debris[i];
            
            deb.vz -= 350 * dt; // Gravity acceleration
            deb.x += deb.vx * 60 * dt;
            deb.y += deb.vy * 60 * dt;
            deb.z += deb.vz * dt;
            
            deb.rotX += deb.vrotX;
            deb.rotY += deb.vrotY;
            deb.rotZ += deb.vrotZ;

            // Delete debris if fallen below viewport bottom
            const pos = this.toScreenSpace(deb.x, deb.y, deb.z);
            if (pos.y > CANVAS_HEIGHT + 200) {
                this.debris.splice(i, 1);
            }
        }

        // Resolve particle flows
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= p.decay;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            if (p.type === 'ripple') {
                p.size += (p.maxSize - p.size) * 0.15;
            } else if (p.type === 'spark') {
                p.vz -= 9.8 * dt; // Gravity
                p.x += p.vx * 30 * dt;
                p.y += p.vy * 30 * dt;
                p.z += p.vz * 30 * dt;
            }
        }
    }

    render() {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        this.ctx.save();
        
        // Handle screen shake translations
        if (this.shakeTimer > 0) {
            const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(shakeX, shakeY);
        }

        // Draw stable stack blocks
        // Only draw the top 22 blocks of the tower for rendering performance
        const startIndex = Math.max(0, this.stack.length - 22);
        for (let i = startIndex; i < this.stack.length; i++) {
            this.drawBlock(this.stack[i]);
        }

        // Draw active sliding block
        if (this.state === 'PLAYING' && this.activeBlock) {
            this.drawBlock(this.activeBlock);
        }

        // Draw debris blocks
        this.debris.forEach(deb => {
            this.drawBlock(deb, true, { x: deb.rotX, y: deb.rotY, z: deb.rotZ });
        });

        // Draw particles
        this.particles.forEach(p => {
            if (p.type === 'ripple') {
                const screenPos = this.toScreenSpace(p.x, p.y, p.z);
                this.ctx.strokeStyle = p.color;
                this.ctx.lineWidth = 3;
                this.ctx.globalAlpha = p.life;
                this.ctx.beginPath();
                this.ctx.ellipse(
                    screenPos.x, 
                    screenPos.y, 
                    p.size * ISO_X, 
                    p.size * ISO_Y, 
                    0, 0, Math.PI * 2
                );
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            } else if (p.type === 'spark') {
                const screenPos = this.toScreenSpace(p.x, p.y, p.z);
                this.ctx.fillStyle = p.color;
                this.ctx.globalAlpha = p.life;
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 1.0;
            }
        });

        this.ctx.restore();
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Cap dt to prevent massive jumps when swapping browser tabs
        if (dt > 0.1) dt = 0.1;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }
}

// Instantiate game on page load
window.addEventListener('load', () => {
    window.game = new Game();
});