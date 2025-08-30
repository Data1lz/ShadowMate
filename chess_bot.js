// ==UserScript==
// @name         ShadowMate
// @namespace    https://github.com/Data1lz/ShadowMate
// @version      14.0
// @description  The final version of a chess bot that combines maximum strength, stability, and full functionality, including a dynamic advantage bar next to the chessboard.
// @author       Data1lz
// @match        https://www.chess.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-idle
// @description The final version of a chess bot for Chess.com, featuring an ELO-adjustable engine, automatic modes, and a dynamic advantage bar.
// ==/UserScript==

(function() {
    'use strict';

    // =====================================================================
    // Configuration Class: Manages bot settings.
    // =====================================================================
    class Configuration {
        constructor() {
            this.elo = GM_getValue('botElo', 2000);
            this.delay = GM_getValue('botDelay', 1);
            this.isBotActive = GM_getValue('isBotActive', false);
            this.isThinking = false;
            this.autoRun = GM_getValue('autoRun', false);
            this.autoMove = GM_getValue('autoMove', false);
            this.autoAdjustElo = GM_getValue('autoAdjustElo', false);
        }

        get elo() { return GM_getValue('botElo', 2000); }
        set elo(value) { GM_setValue('botElo', value); }

        get delay() { return GM_getValue('botDelay', 1); }
        set delay(value) { GM_setValue('botDelay', value); }

        get isBotActive() { return GM_getValue('isBotActive', false); }
        set isBotActive(value) { GM_setValue('isBotActive', value); }

        get autoRun() { return GM_getValue('autoRun', false); }
        set autoRun(value) { GM_setValue('autoRun', value); }

        get autoMove() { return GM_getValue('autoMove', false); }
        set autoMove(value) { GM_setValue('autoMove', value); }

        get autoAdjustElo() { return GM_getValue('autoAdjustElo', false); }
        set autoAdjustElo(value) { GM_setValue('autoAdjustElo', value); }
    }

    // =====================================================================
    // UI Class: Manages user interface interactions.
    // =====================================================================
    class UI {
        constructor(config, engine, gameWatcher) {
            this.config = config;
            this.engine = engine;
            this.gameWatcher = gameWatcher;
            this.elements = {};
        }

        init() {
            this.createUIElements();
            this.setupEventListeners();
            this.updateUIFromConfig();
            this.makeDraggable(this.elements.uiContainer);
        }

        createUIElements() {
            const uiHTML = `
                <div id="chess-bot-ui" style="position: fixed; top: 10px; right: 10px; background-color: #333; color: white; padding: 15px; border-radius: 8px; z-index: 10000; font-family: Arial, sans-serif; border: 2px solid #555; box-shadow: 0 4px 8px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 10px; resize: both; overflow: auto; min-width: 250px;">
                    <h3 style="margin: 0; text-align: center; cursor: move;">Chess Bot PRO</h3>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label for="elo-slider">Playing Strength (ELO):</label>
                        <input type="range" id="elo-slider" min="1000" max="3000" step="100" style="flex-grow: 1;">
                        <span id="elo-value"></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label for="delay-slider">Move Delay (sec):</label>
                        <input type="range" id="delay-slider" min="0.1" max="5" step="0.1" style="flex-grow: 1;">
                        <span id="delay-value"></span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <span>Modes:</span>
                        <div style="display: flex; gap: 5px;">
                            <button id="bullet-btn" style="padding: 8px; flex-grow: 1; background-color: #444; color: white; border: none; border-radius: 4px; cursor: pointer;">Bullet</button>
                            <button id="blitz-btn" style="padding: 8px; flex-grow: 1; background-color: #444; color: white; border: none; border-radius: 4px; cursor: pointer;">Blitz</button>
                            <button id="10min-btn" style="padding: 8px; flex-grow: 1; background-color: #444; color: white; border: none; border-radius: 4px; cursor: pointer;">10min</button>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <label><input type="checkbox" id="auto-run"> Auto Start</label>
                        <label><input type="checkbox" id="auto-move"> Auto Move</label>
                        <label><input type="checkbox" id="auto-adjust-elo"> Auto Adjust ELO</label>
                    </div>
                    <button id="toggle-bot" style="padding: 10px; background-color: #5cb85c; color: white; border: none; border-radius: 4px; cursor: pointer;">Disable</button>
                    <div id="status" style="text-align: center;">Bot is disabled</div>
                    <div id="debug-info" style="font-size: 10px; color: #aaa;"></div>
                    <button id="show-best-move-btn" style="padding: 8px; background-color: #555; color: white; border: none; border-radius: 4px; cursor: pointer;">Show Best Move</button>
                    <button id="show-opponent-move-btn" style="padding: 8px; background-color: #555; color: white; border: none; border-radius: 4px; cursor: pointer;">Show Opponent's Move</button>
                </div>
            `;
            $('body').append(uiHTML);
            this.elements = {
                uiContainer: $('#chess-bot-ui'),
                eloSlider: $('#elo-slider'),
                eloValue: $('#elo-value'),
                delaySlider: $('#delay-slider'),
                delayValue: $('#delay-value'),
                toggleBotBtn: $('#toggle-bot'),
                autoRunCb: $('#auto-run'),
                autoMoveCb: $('#auto-move'),
                autoAdjustEloCb: $('#auto-adjust-elo'),
                statusDiv: $('#status'),
                debugInfo: $('#debug-info'),
                showMoveBtn: $('#show-best-move-btn'),
                showOpponentMoveBtn: $('#show-opponent-move-btn')
            };

            // Create the Advantage Bar container and bar
            const advantageBarContainerHTML = `
                <div id="advantage-bar-container" style="position: absolute; width: 30px; height: 100%; background-color: #555; border-radius: 5px; overflow: hidden; border: 1px solid #444; box-sizing: border-box;">
                    <div id="advantage-bar" style="width: 100%; height: 50%; background-color: #fff;"></div>
                </div>
            `;
            $('body').append(advantageBarContainerHTML);
            this.elements.advantageBar = $('#advantage-bar');
            this.elements.advantageBarContainer = $('#advantage-bar-container');
        }

        positionAdvantageBar() {
            const boardEl = this.gameWatcher.getBoardElement();
            if (boardEl) {
                const $boardEl = $(boardEl);
                const boardOffset = $boardEl.offset();
                const boardHeight = $boardEl.outerHeight();

                this.elements.advantageBarContainer.css({
                    top: boardOffset.top,
                    left: boardOffset.left - this.elements.advantageBarContainer.outerWidth() - 10, // 10px margin to the left
                    height: boardHeight,
                    display: 'block'
                });
            } else {
                this.elements.advantageBarContainer.hide();
            }
        }

        setupEventListeners() {
            this.elements.eloSlider.on('input', (e) => this.handleEloChange(e.target.value));
            this.elements.delaySlider.on('input', (e) => this.handleDelayChange(e.target.value));
            this.elements.toggleBotBtn.on('click', () => this.handleToggleBot());
            this.elements.autoRunCb.on('change', () => this.handleAutoRunChange());
            this.elements.autoMoveCb.on('change', () => this.handleAutoMoveChange());
            this.elements.autoAdjustEloCb.on('change', () => this.handleAutoAdjustEloChange());
            this.elements.showMoveBtn.on('click', () => this.handleShowBestMove());
            this.elements.showOpponentMoveBtn.on('click', () => this.handleShowOpponentMove());
            $('#bullet-btn').on('click', () => this.setPresetMode(1600, 0.5));
            $('#blitz-btn').on('click', () => this.setPresetMode(2000, 1.5));
            $('#10min-btn').on('click', () => this.setPresetMode(2500, 3));

            // Reposition the advantage bar on window resize
            $(window).on('resize', () => this.positionAdvantageBar());
        }

        handleEloChange(value) {
            this.config.elo = parseInt(value);
            this.elements.eloValue.text(this.config.elo);
        }

        handleDelayChange(value) {
            this.config.delay = parseFloat(value);
            this.elements.delayValue.text(this.config.delay.toFixed(1));
        }

        handleToggleBot() {
            this.config.isBotActive = !this.config.isBotActive;
            this.updateToggleButton();
            this.updateStatus();
        }

        handleAutoRunChange() {
            this.config.autoRun = this.elements.autoRunCb.is(':checked');
        }

        handleAutoMoveChange() {
            this.config.autoMove = this.elements.autoMoveCb.is(':checked');
        }

        handleAutoAdjustEloChange() {
            this.config.autoAdjustElo = this.elements.autoAdjustEloCb.is(':checked');
        }

        handleShowBestMove() {
            if (!this.config.isThinking) {
                const fen = this.gameWatcher.getBoardFEN();
                if (fen) {
                    this.engine.findBestMove(fen, true);
                }
            }
        }

        handleShowOpponentMove() {
            if (!this.config.isThinking) {
                const fen = this.gameWatcher.getBoardFEN();
                if (fen) {
                    const opponentFen = this.gameWatcher.getOpponentBoardFEN(fen);
                    this.engine.findBestMove(opponentFen, true);
                }
            }
        }

        setPresetMode(elo, delay) {
            this.config.elo = elo;
            this.config.delay = delay;
            this.elements.eloSlider.val(elo);
            this.elements.eloValue.text(elo);
            this.elements.delaySlider.val(delay);
            this.elements.delayValue.text(delay.toFixed(1));
            this.updateStatus(`Mode set to ${elo} ELO with ${delay}s delay.`);
        }

        updateUIFromConfig() {
            this.elements.eloSlider.val(this.config.elo);
            this.elements.eloValue.text(this.config.elo);
            this.elements.delaySlider.val(this.config.delay);
            this.elements.delayValue.text(this.config.delay.toFixed(1));
            this.elements.autoRunCb.prop('checked', this.config.autoRun);
            this.elements.autoMoveCb.prop('checked', this.config.autoMove);
            this.elements.autoAdjustEloCb.prop('checked', this.config.autoAdjustElo);
            this.updateToggleButton();
            this.updateStatus();
        }

        updateToggleButton() {
            if (this.config.isBotActive) {
                this.elements.toggleBotBtn.text('Disable');
                this.elements.toggleBotBtn.css('background-color', '#d9534f');
            } else {
                this.elements.toggleBotBtn.text('Enable');
                this.elements.toggleBotBtn.css('background-color', '#5cb85c');
            }
        }

        updateStatus(message = '') {
            this.elements.statusDiv.text(message || (this.config.isBotActive ? 'Bot is active' : 'Bot is disabled'));
        }

        updateDebug(message) {
            this.elements.debugInfo.text(message);
        }

        highlightMove(move) {
            $('.highlight.bro').remove();
            const boardEl = this.gameWatcher.getBoardElement();
            if (!boardEl) return;
            const startSquare = `square-${move.from}`;
            const endSquare = `square-${move.to}`;

            const highlightDiv = $(`<div>`).addClass(`highlight bro ${startSquare}`).css({
                backgroundColor: 'rgba(235, 97, 80, 0.71)'
            });
            $(boardEl).prepend(highlightDiv);

            const highlightDiv2 = $(`<div>`).addClass(`highlight bro ${endSquare}`).css({
                backgroundColor: 'rgba(235, 97, 80, 0.71)'
            });
            $(boardEl).prepend(highlightDiv2);
        }

        updateAdvantageBar(score) {
            let heightPercentage;
            let color;
            const myColor = this.gameWatcher.getMyColor(); // 'w' or 'b'
            
            // Maximum centipawn advantage to map to 100% or 0% of the bar
            const maxCp = 1000; // 10 pawns is a huge advantage

            if (score.type === 'cp') {
                let cp = score.value; // Stockfish reports cp in hundreds

                // Normalize cp relative to maxCp
                let normalizedCp = Math.max(-maxCp, Math.min(maxCp, cp));
                
                // Map to a percentage for the bar height (0% to 100%)
                // If cp is positive (white advantage), heightPercentage increases from 50% to 100%.
                // If cp is negative (black advantage), heightPercentage decreases from 50% to 0%.
                heightPercentage = (normalizedCp / (2 * maxCp) + 0.5) * 100;

                // If playing as black, the bar needs to be inverted visually
                // A higher value (white advantage) means less white bar (more black) when playing black
                if (myColor === 'b') {
                    heightPercentage = 100 - heightPercentage;
                }

                // Color based on advantage: green for white, red for black, yellow for balanced
                if (cp > 100) { // More than 1 pawn advantage for white
                    color = '#5cb85c'; // Green
                } else if (cp < -100) { // More than 1 pawn advantage for black
                    color = '#d9534f'; // Red
                } else {
                    color = '#f0ad4e'; // Yellow (balanced)
                }

            } else if (score.type === 'mate') {
                if (score.value > 0) { // White to mate
                    heightPercentage = myColor === 'w' ? 100 : 0;
                    color = '#007bff'; // Blue
                } else { // Black to mate
                    heightPercentage = myColor === 'w' ? 0 : 100;
                    color = '#d9534f'; // Red
                }
            }
            
            this.elements.advantageBar.css({
                height: `${heightPercentage}%`,
                backgroundColor: color,
                transition: 'height 0.5s ease, background-color 0.5s ease'
            });
        }
        
        makeDraggable(el) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            const header = el.find('h3');
            header.on('mousedown', dragMouseDown);

            function dragMouseDown(e) {
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                $(document).on('mouseup', closeDragElement);
                $(document).on('mousemove', elementDrag);
            }

            function elementDrag(e) {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                el.css({
                    top: (el.offset().top - pos2) + "px",
                    left: (el.offset().left - pos1) + "px"
                });
            }

            function closeDragElement() {
                $(document).off('mouseup', closeDragElement);
                $(document).off('mousemove', elementDrag);
            }
        }
    }

    // =====================================================================
    // Engine Class: Handles communication with Stockfish.
    // =====================================================================
    class Engine {
        constructor(config, ui, moveSimulator) {
            this.config = config;
            this.ui = ui;
            this.moveSimulator = moveSimulator;
            this.worker = null;
            this.currentFEN = null; // Store the FEN we are currently analyzing
        }

        init() {
            GM_xmlhttpRequest({
                method: "GET",
                url: "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/9.0.0/stockfish.js",
                onload: (response) => {
                    const blob = new Blob([response.responseText], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    this.worker = new Worker(url);
                    this.worker.onmessage = (e) => this.handleMessage(e);
                    this.worker.postMessage('uci');
                    this.worker.postMessage('isready');
                }
            });
        }

        handleMessage(event) {
            const data = event.data;
            // this.ui.updateDebug(data); // Can be very verbose

            // Check for info lines to update the advantage bar
            if (data.startsWith('info')) {
                const scoreMatch = data.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    const type = scoreMatch[1];
                    const value = parseInt(scoreMatch[2]);
                    this.ui.updateAdvantageBar({ type, value });
                }
            }
            
            if (data.includes('bestmove')) {
                const bestMove = data.split(' ')[1];
                if (bestMove && bestMove !== '(none)') {
                    const from = bestMove.substring(0, 2);
                    const to = bestMove.substring(2, 4);
                    const promotion = bestMove.length > 4 ? bestMove.substring(4, 5) : '';

                    this.ui.updateStatus(`Best move found: ${from}${to}`);
                    if (this.config.autoMove) {
                        this.moveSimulator.makeMove(from, to, promotion);
                    } else {
                        this.ui.highlightMove({ from, to });
                    }
                }
                this.config.isThinking = false;
                this.ui.updateStatus('Bot is waiting...');
            }
        }

        findBestMove(fen, forceHighlight = false) {
            if (this.worker) {
                this.currentFEN = fen; // Store the FEN being analyzed
                this.config.isThinking = true;
                this.ui.updateStatus('Bot is thinking...');
                this.worker.postMessage(`position fen ${fen}`);
                const depth = Math.max(1, Math.round((this.config.elo - 1000) / 100) + 1);
                this.worker.postMessage(`go depth ${depth}`);
            }
        }
        
        // Function to continuously analyze the current board for the advantage bar
        analyzeCurrentBoardForAdvantage() {
            if (this.worker && !this.config.isThinking) {
                const currentBoardFEN = this.gameWatcher.getBoardFEN();
                if (currentBoardFEN && currentBoardFEN !== this.currentFEN) {
                    this.currentFEN = currentBoardFEN;
                    this.worker.postMessage(`position fen ${currentBoardFEN}`);
                    this.worker.postMessage('go depth 10'); // A reasonable depth for quick evaluation
                }
            }
        }
    }

    // =====================================================================
    // GameWatcher Class: Monitors the game state.
    // =====================================================================
    class GameWatcher {
        constructor(config, ui, engine) {
            this.config = config;
            this.ui = ui;
            this.engine = engine;
            this.intervalId = null;
            this.opponentElo = null;
            this.lastFEN = null; // To detect board changes for advantage bar
        }

        init() {
            this.intervalId = setInterval(() => this.checkGameState(), 1000);
            this.detectOpponentElo();
        }
        
        detectOpponentElo() {
             const opponentEloElement = $('.player-opponent .user-tagline-rating');
             if (opponentEloElement.length > 0) {
                 this.opponentElo = parseInt(opponentEloElement.text().trim(), 10);
                 if (this.config.autoAdjustElo) {
                     this.config.elo = this.opponentElo;
                     this.ui.elements.eloSlider.val(this.opponentElo);
                     this.ui.elements.eloValue.text(this.opponentElo);
                     this.ui.updateStatus(`ELO adjusted to opponent's ELO: ${this.opponentElo}`);
                 }
             }
        }

        checkGameState() {
            const currentFEN = this.getBoardFEN();
            
            // Reposition advantage bar if board is present
            if (currentFEN) {
                this.ui.positionAdvantageBar();
            } else {
                this.ui.elements.advantageBarContainer.hide();
            }

            // Update advantage bar if FEN has changed and bot is not actively finding a move
            if (currentFEN && currentFEN !== this.lastFEN) {
                this.lastFEN = currentFEN;
                this.engine.analyzeCurrentBoardForAdvantage();
            }

            // Bot's turn logic
            if (!this.config.isBotActive || this.config.isThinking) return;

            const boardEl = this.getBoardElement();
            if (!boardEl || !boardEl.game || !boardEl.game.getPlayingAs || !boardEl.game.getFEN) {
                this.config.isBotActive = false; // Deactivate bot if game elements are not found
                return;
            }

            const myColor = boardEl.game.getPlayingAs();
            const currentTurn = boardEl.game.getTurn();

            if (myColor === currentTurn && this.config.autoRun) {
                this.config.isThinking = true;
                const delayMs = this.config.delay * 1000;
                setTimeout(() => {
                    this.engine.findBestMove(currentFEN);
                }, delayMs);
            }
        }
        
        getMyColor() {
            const boardEl = this.getBoardElement();
            return boardEl ? boardEl.game.getPlayingAs() : null;
        }

        getBoardElement() {
            return $('chess-board, wc-chess-board')[0];
        }

        getBoardFEN() {
            const boardEl = this.getBoardElement();
            return boardEl ? boardEl.game.getFEN() : null;
        }

        getOpponentBoardFEN(fen) {
            const parts = fen.split(' ');
            const boardPart = parts[0];
            const turnPart = parts[1];
            const newTurn = turnPart === 'w' ? 'b' : 'w';
            return `${boardPart} ${newTurn} ${parts[2]} ${parts[3]} ${parts[4]} ${parts[5]}`;
        }
    }

    // =====================================================================
    // MoveSimulator Class: Provides a reliable way to move pieces.
    // =====================================================================
    class MoveSimulator {
        constructor(gameWatcher) {
            this.gameWatcher = gameWatcher;
        }

        makeMove(from, to, promotion) {
            const boardEl = this.gameWatcher.getBoardElement();
            if (!boardEl) return;

            const gameData = boardEl.game;
            if (!gameData) return;

            // Attempt to make the move using the internal API
            const move = gameData.getLegalMoves().find(m => m.from === from && m.to === to);
            if (move) {
                try {
                    gameData.move({
                        ...move,
                        promotion: promotion || null,
                        animate: true,
                        userGenerated: true
                    });
                    console.log("Successfully made a move via game.move()");
                } catch (e) {
                    console.error("Failed to make a move via game.move(), reverting to click simulation:", e);
                    this.simulateMouseEvents(from, to, promotion);
                }
            } else {
                console.error("Invalid move: ", from, to);
            }
        }

        // Fallback option: Simulate mouse clicks
        simulateMouseEvents(from, to, promotion) {
            const boardEl = this.gameWatcher.getBoardElement();
            if (!boardEl) return;

            const startEl = boardEl.querySelector(`.square-${from}`);
            const endEl = boardEl.querySelector(`.square-${to}`);

            if (startEl && endEl) {
                const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
                const mouseupEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
                startEl.dispatchEvent(mousedownEvent);
                endEl.dispatchEvent(mouseupEvent);

                if (promotion) {
                    setTimeout(() => this.handlePromotion(promotion), 500);
                }
                console.log("Move made via click simulation");
            }
        }

        handlePromotion(promotion) {
            const promotionDialog = $('.promotion-dialog');
            if (promotionDialog.length) {
                const promotionPiece = promotionDialog.find(`.promotion-piece-${promotion}`);
                if (promotionPiece.length) {
                    promotionPiece.trigger('click');
                }
            }
        }
    }

    // =====================================================================
    // ChessBot Class: Main initialization class.
    // =====================================================================
    class ChessBot {
        constructor() {
            this.config = new Configuration();
            this.ui = new UI(this.config, null, null); // Pass null initially, then assign
            this.moveSimulator = new MoveSimulator(null); // Pass null initially
            this.engine = new Engine(this.config, this.ui, this.moveSimulator);
            this.gameWatcher = new GameWatcher(this.config, this.ui, this.engine);
            
            // Now assign the full objects to avoid circular dependencies in constructors
            this.ui.engine = this.engine;
            this.ui.gameWatcher = this.gameWatcher;
            this.moveSimulator.gameWatcher = this.gameWatcher;
        }

        init() {
            this.ui.init();
            this.engine.init();
            this.gameWatcher.init();
        }
    }

    // =====================================================================
    // Project Startup
    // =====================================================================
    $(document).ready(() => {
        const bot = new ChessBot();
        bot.init();
    });
})();
