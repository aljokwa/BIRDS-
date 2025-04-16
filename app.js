class BirdSynth {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        
        this.recordings = [];
        this.isRecording = false;
        this.isPlaying = false;
        this.isLooping = false;
        this.recordingStartTime = 0;
        this.recordingEvents = [];
        this.currentPlayback = null;
        this.activeOscillators = new Set();
        this.currentProgress = 0;
        this.progressInterval = null;
        
        this.echoEnabled = false;
        this.tapeEnabled = false;
        this.tapeSpeed = 1;
        this.tapeDirection = 1;

        this.pattern = [];
        this.isRecordingPattern = false;
        this.patternStartTime = 0;
        this.isPlayingPattern = false;
        
        this.soundTypes = {
            bird: {
                chirp: { baseFreq: 800, modFreq: 10, modDepth: 50 },
                whistle: { baseFreq: 1200, modFreq: 5, modDepth: 30 },
                trill: { baseFreq: 1000, modFreq: 20, modDepth: 70 },
                tweet: { baseFreq: 1500, modFreq: 15, modDepth: 40 },
                warble: { baseFreq: 900, modFreq: 8, modDepth: 60 },
                peep: { baseFreq: 2000, modFreq: 12, modDepth: 35 },
                coo: { baseFreq: 600, modFreq: 3, modDepth: 25 },
                squawk: { baseFreq: 700, modFreq: 25, modDepth: 80 }
            },
            bass: {
                bass: { baseFreq: 100, modFreq: 2, modDepth: 20, type: 'sawtooth' },
                heavyBass: { baseFreq: 80, modFreq: 1, modDepth: 30, type: 'sawtooth' },
                subBass: { baseFreq: 60, modFreq: 0.5, modDepth: 40, type: 'sawtooth' },
                growl: { baseFreq: 120, modFreq: 4, modDepth: 50, type: 'sawtooth' }
            }
        };
        
        this.setupCanvas();
        this.setupControls();
        this.setupAudioNodes();
        this.setupRecordingControls();
        this.setupEffects();
        this.setupBeatPad();
        this.setupKeyboardControls();
    }

    setupCanvas() {
        this.canvas = document.getElementById('visualizer');
        this.canvasCtx = this.canvas.getContext('2d');
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setupControls() {
        this.buttons = {
            chirp: document.getElementById('chirp'),
            whistle: document.getElementById('whistle'),
            trill: document.getElementById('trill'),
            warble: document.getElementById('warble')
        };

        this.sliders = {
            frequency: document.getElementById('frequency'),
            modulation: document.getElementById('modulation'),
            attack: document.getElementById('attack'),
            release: document.getElementById('release')
        };

        Object.entries(this.buttons).forEach(([type, button]) => {
            button.addEventListener('mousedown', () => this.playSound(type));
            button.addEventListener('mouseup', () => this.stopSound());
        });
    }

    setupAudioNodes() {
        this.oscillator = this.audioContext.createOscillator();
        this.modulator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        this.modGain = this.audioContext.createGain();

        this.modulator.connect(this.modGain);
        this.modGain.connect(this.oscillator.frequency);
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        this.oscillator.type = 'sine';
        this.modulator.type = 'sine';
    }

    setupRecordingControls() {
        this.recordButton = document.getElementById('record');
        this.stopButton = document.getElementById('stop');
        this.playButton = document.getElementById('play');
        this.pauseButton = document.getElementById('pause');
        this.clearButton = document.getElementById('clear');
        this.recordingList = document.getElementById('recordingList');

        this.recordButton.addEventListener('click', () => this.startRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());
        this.playButton.addEventListener('click', () => this.playRecording());
        this.pauseButton.addEventListener('click', () => this.pausePlayback());
        this.clearButton.addEventListener('click', () => this.clearRecordings());
    }

    setupEffects() {
        // Echo effect
        this.echoDelay = this.audioContext.createDelay(1.0);
        this.echoFeedback = this.audioContext.createGain();
        this.echoWet = this.audioContext.createGain();
        
        this.echoDelay.delayTime.value = 0.3;
        this.echoFeedback.gain.value = 0.5;
        this.echoWet.gain.value = 0.5;

        // Tape effect
        this.tapeOscillator = this.audioContext.createOscillator();
        this.tapeGain = this.audioContext.createGain();
        this.tapeOscillator.frequency.value = 0.1;
        this.tapeGain.gain.value = 0.1;
        this.tapeOscillator.start();

        // Connect effects
        this.echoDelay.connect(this.echoFeedback);
        this.echoFeedback.connect(this.echoDelay);
        this.echoDelay.connect(this.echoWet);
        this.echoWet.connect(this.analyser);

        this.tapeOscillator.connect(this.tapeGain);
        this.tapeGain.connect(this.analyser);

        // Setup effect controls
        this.setupEffectControls();
    }

    setupEffectControls() {
        // Echo controls
        const echoEnabled = document.getElementById('echoEnabled');
        const echoDelay = document.getElementById('echoDelay');
        const echoFeedback = document.getElementById('echoFeedback');
        const echoDelayValue = document.getElementById('echoDelayValue');
        const echoFeedbackValue = document.getElementById('echoFeedbackValue');

        echoEnabled.addEventListener('change', (e) => {
            this.echoEnabled = e.target.checked;
            this.updateEffectRouting();
        });

        echoDelay.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.echoDelay.delayTime.value = value;
            echoDelayValue.textContent = `${value.toFixed(1)}s`;
        });

        echoFeedback.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.echoFeedback.gain.value = value;
            echoFeedbackValue.textContent = value.toFixed(1);
        });

        // Tape controls
        const tapeEnabled = document.getElementById('tapeEnabled');
        const wow = document.getElementById('wow');
        const flutter = document.getElementById('flutter');
        const wowValue = document.getElementById('wowValue');
        const flutterValue = document.getElementById('flutterValue');
        const tapePlay = document.getElementById('tapePlay');
        const tapeReverse = document.getElementById('tapeReverse');
        const tapeSlow = document.getElementById('tapeSlow');
        const tapeFast = document.getElementById('tapeFast');

        tapeEnabled.addEventListener('change', (e) => {
            this.tapeEnabled = e.target.checked;
            this.updateEffectRouting();
        });

        wow.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.tapeOscillator.frequency.value = value * 0.2;
            wowValue.textContent = value.toFixed(1);
        });

        flutter.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.tapeGain.gain.value = value * 0.2;
            flutterValue.textContent = value.toFixed(1);
        });

        tapePlay.addEventListener('click', () => {
            this.tapeSpeed = 1;
            this.tapeDirection = 1;
            this.updateTapeControls();
        });

        tapeReverse.addEventListener('click', () => {
            this.tapeDirection = -1;
            this.updateTapeControls();
        });

        tapeSlow.addEventListener('click', () => {
            this.tapeSpeed = 0.5;
            this.updateTapeControls();
        });

        tapeFast.addEventListener('click', () => {
            this.tapeSpeed = 2;
            this.updateTapeControls();
        });
    }

    updateTapeControls() {
        const buttons = ['tapePlay', 'tapeReverse', 'tapeSlow', 'tapeFast'];
        buttons.forEach(id => {
            const button = document.getElementById(id);
            button.classList.remove('active');
        });

        if (this.tapeDirection === -1) {
            document.getElementById('tapeReverse').classList.add('active');
        } else {
            if (this.tapeSpeed === 0.5) {
                document.getElementById('tapeSlow').classList.add('active');
            } else if (this.tapeSpeed === 2) {
                document.getElementById('tapeFast').classList.add('active');
            } else {
                document.getElementById('tapePlay').classList.add('active');
            }
        }
    }

    updateEffectRouting() {
        this.cleanupOscillators();
        this.setupAudioNodes();
    }

    startRecording() {
        if (!this.isRecording) {
            this.isRecording = true;
            this.recordingStartTime = this.audioContext.currentTime;
            this.recordingEvents = [];
            this.recordButton.classList.add('recording');
            this.recordButton.textContent = 'Recording...';
        }
    }

    stopRecording() {
        if (this.isRecording) {
            this.isRecording = false;
            this.recordButton.classList.remove('recording');
            this.recordButton.textContent = 'Record';
            
            if (this.recordingEvents.length > 0) {
                const recording = {
                    events: this.recordingEvents,
                    duration: this.audioContext.currentTime - this.recordingStartTime
                };
                this.recordings.push(recording);
                this.addRecordingToUI(recording);
            }
        }
    }

    addRecordingToUI(recording) {
        const recordingItem = document.createElement('div');
        recordingItem.className = 'recording-item';
        
        const header = document.createElement('div');
        header.className = 'recording-header';
        
        const recordingInfo = document.createElement('span');
        recordingInfo.textContent = `Recording ${this.recordings.length} (${recording.duration.toFixed(2)}s)`;
        
        const controls = document.createElement('div');
        controls.className = 'recording-controls';
        
        const playButton = document.createElement('button');
        playButton.textContent = 'Play';
        playButton.addEventListener('click', () => this.playRecording(this.recordings.length - 1));
        
        const loopCheckbox = document.createElement('input');
        loopCheckbox.type = 'checkbox';
        loopCheckbox.id = `loop-${this.recordings.length - 1}`;
        loopCheckbox.addEventListener('change', (e) => {
            this.isLooping = e.target.checked;
            if (this.isPlaying) {
                this.stopPlayback();
                this.playRecording(this.recordings.length - 1);
            }
        });
        
        const loopLabel = document.createElement('label');
        loopLabel.htmlFor = `loop-${this.recordings.length - 1}`;
        loopLabel.textContent = 'Loop';
        
        const loopControls = document.createElement('div');
        loopControls.className = 'loop-controls';
        loopControls.appendChild(loopCheckbox);
        loopControls.appendChild(loopLabel);
        
        controls.appendChild(playButton);
        controls.appendChild(loopControls);
        
        header.appendChild(recordingInfo);
        header.appendChild(controls);
        
        const soundEvents = document.createElement('div');
        soundEvents.className = 'sound-events';
        
        recording.events.forEach((event, index) => {
            const soundEvent = this.createSoundEventUI(event, index, this.recordings.length - 1);
            soundEvents.appendChild(soundEvent);
        });
        
        recordingItem.appendChild(header);
        recordingItem.appendChild(soundEvents);
        this.recordingList.appendChild(recordingItem);
    }

    createSoundEventUI(event, index, recordingIndex) {
        const soundEvent = document.createElement('div');
        soundEvent.className = 'sound-event';
        
        const typeSelect = document.createElement('select');
        ['chirp', 'whistle', 'trill', 'warble'].forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeSelect.appendChild(option);
        });
        
        const frequencySlider = document.createElement('input');
        frequencySlider.type = 'range';
        frequencySlider.min = '200';
        frequencySlider.max = '2000';
        frequencySlider.value = event.frequency;
        
        const modulationSlider = document.createElement('input');
        modulationSlider.type = 'range';
        modulationSlider.min = '0';
        modulationSlider.max = '100';
        modulationSlider.value = event.modulation;
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', () => {
            this.recordings[recordingIndex].events.splice(index, 1);
            soundEvent.remove();
            this.updateRecordingDuration(recordingIndex);
        });
        
        const updateEvent = () => {
            this.recordings[recordingIndex].events[index] = {
                ...event,
                type: typeSelect.value,
                frequency: parseFloat(frequencySlider.value),
                modulation: parseFloat(modulationSlider.value),
                modulationFrequency: this.getModulationFrequency(typeSelect.value)
            };
        };
        
        typeSelect.addEventListener('change', updateEvent);
        frequencySlider.addEventListener('input', updateEvent);
        modulationSlider.addEventListener('input', updateEvent);
        
        soundEvent.appendChild(typeSelect);
        soundEvent.appendChild(frequencySlider);
        soundEvent.appendChild(modulationSlider);
        soundEvent.appendChild(deleteButton);
        
        return soundEvent;
    }

    updateRecordingDuration(recordingIndex) {
        const recording = this.recordings[recordingIndex];
        if (recording.events.length === 0) {
            recording.duration = 0;
        } else {
            const lastEvent = recording.events[recording.events.length - 1];
            recording.duration = lastEvent.time + lastEvent.attack + lastEvent.release;
        }
        this.updateRecordingInfo(recordingIndex);
    }

    updateRecordingInfo(recordingIndex) {
        const recordingItem = this.recordingList.children[recordingIndex];
        const infoSpan = recordingItem.querySelector('.recording-header span');
        infoSpan.textContent = `Recording ${recordingIndex + 1} (${this.recordings[recordingIndex].duration.toFixed(2)}s)`;
    }

    updateProgressBar(progress) {
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = `${progress * 100}%`;
    }

    createOscillator() {
        const oscillator = this.audioContext.createOscillator();
        const modulator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const modGain = this.audioContext.createGain();

        modulator.connect(modGain);
        modGain.connect(oscillator.frequency);
        oscillator.connect(gainNode);

        if (this.echoEnabled) {
            gainNode.connect(this.echoDelay);
            gainNode.connect(this.analyser);
        } else if (this.tapeEnabled) {
            gainNode.connect(this.tapeGain);
            gainNode.connect(this.analyser);
        } else {
            gainNode.connect(this.analyser);
        }

        oscillator.type = 'sine';
        modulator.type = 'sine';

        this.activeOscillators.add({ oscillator, modulator, gainNode, modGain });
        return { oscillator, modulator, gainNode, modGain };
    }

    cleanupOscillators() {
        this.activeOscillators.forEach(({ oscillator, modulator, gainNode }) => {
            try {
                oscillator.stop();
                modulator.stop();
                gainNode.disconnect();
            } catch (e) {
                console.log('Error cleaning up oscillators:', e);
            }
        });
        this.activeOscillators.clear();
    }

    playRecording(index = null) {
        if (this.isPlaying) return;
        
        const recording = index !== null ? this.recordings[index] : this.recordings[this.recordings.length - 1];
        if (!recording) return;

        this.isPlaying = true;
        this.playButton.classList.add('playing');
        this.playButton.textContent = 'Playing...';
        this.currentProgress = 0;
        this.updateProgressBar(0);

        const playLoop = () => {
            const startTime = this.audioContext.currentTime;
            
            recording.events.forEach(event => {
                const { oscillator, modulator, gainNode, modGain } = this.createOscillator();
                
                const time = startTime + (event.time * this.tapeDirection / this.tapeSpeed);
                oscillator.frequency.setValueAtTime(event.frequency, time);
                modulator.frequency.setValueAtTime(event.modulationFrequency, time);
                modGain.gain.setValueAtTime(event.modulation, time);
                
                gainNode.gain.setValueAtTime(0, time);
                gainNode.gain.linearRampToValueAtTime(1, time + event.attack);
                gainNode.gain.linearRampToValueAtTime(0, time + event.attack + event.release);

                oscillator.start(time);
                modulator.start(time);
            });

            this.progressInterval = setInterval(() => {
                this.currentProgress += (0.1 * this.tapeDirection) / (recording.duration * this.tapeSpeed);
                if (this.currentProgress >= 1 || this.currentProgress <= 0) {
                    if (!this.isLooping) {
                        this.stopPlayback();
                        return;
                    }
                    this.currentProgress = this.tapeDirection === 1 ? 0 : 1;
                }
                this.updateProgressBar(this.currentProgress);
            }, 100);

            this.currentPlayback = setTimeout(() => {
                this.cleanupOscillators();
                if (this.isLooping) {
                    playLoop();
                } else {
                    this.stopPlayback();
                }
            }, (recording.duration / this.tapeSpeed + 1) * 1000);
        };

        playLoop();
    }

    pausePlayback() {
        if (this.isPlaying) {
            this.stopPlayback();
        }
    }

    stopPlayback() {
        if (this.currentPlayback) {
            clearTimeout(this.currentPlayback);
            this.currentPlayback = null;
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        this.isPlaying = false;
        this.playButton.classList.remove('playing');
        this.playButton.textContent = 'Play';
        this.currentProgress = 0;
        this.updateProgressBar(0);
        this.cleanupOscillators();
    }

    clearRecordings() {
        this.recordings = [];
        this.recordingList.innerHTML = '';
        this.stopPlayback();
    }

    playSound(type) {
        const category = type.includes('bass') ? 'bass' : 'bird';
        const soundConfig = this.soundTypes[category][type];
        
        if (!soundConfig) return;

        const frequency = soundConfig.baseFreq;
        const modulation = soundConfig.modDepth;
        const attack = parseFloat(this.sliders.attack.value);
        const release = parseFloat(this.sliders.release.value);
        const modulationFrequency = soundConfig.modFreq;

        const { oscillator, modulator, gainNode, modGain } = this.createOscillator();

        // Set oscillator type based on sound configuration
        oscillator.type = soundConfig.type || 'sine';
        modulator.type = 'sine';

        const time = this.audioContext.currentTime;
        oscillator.frequency.setValueAtTime(frequency, time);
        modulator.frequency.setValueAtTime(modulationFrequency, time);
        modGain.gain.setValueAtTime(modulation, time);

        // Add a lowpass filter for bass sounds
        if (category === 'bass') {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 200;
            oscillator.disconnect();
            oscillator.connect(filter);
            filter.connect(gainNode);
        }

        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(1, time + attack);
        gainNode.gain.linearRampToValueAtTime(0, time + attack + release);

        oscillator.start(time);
        modulator.start(time);
        this.visualize();

        if (this.isRecording) {
            this.recordingEvents.push({
                time: time - this.recordingStartTime,
                frequency,
                modulation,
                modulationFrequency,
                attack,
                release,
                type: type,
                category: category
            });
        }

        // Clean up after sound is done playing
        setTimeout(() => {
            try {
                oscillator.stop();
                modulator.stop();
                gainNode.disconnect();
                this.activeOscillators.delete({ oscillator, modulator, gainNode, modGain });
            } catch (e) {
                console.log('Error cleaning up sound:', e);
            }
        }, (attack + release) * 1000);
    }

    stopSound() {
        const release = parseFloat(this.sliders.release.value);
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + release);
        
        setTimeout(() => {
            this.oscillator.stop();
            this.modulator.stop();
            this.setupAudioNodes();
        }, release * 1000);
    }

    getModulationFrequency(type) {
        const frequencies = {
            chirp: 10,
            whistle: 5,
            trill: 20,
            warble: 15
        };
        return frequencies[type] || 10;
    }

    visualize() {
        const draw = () => {
            requestAnimationFrame(draw);
            this.analyser.getByteTimeDomainData(this.dataArray);

            this.canvasCtx.fillStyle = 'rgb(0, 0, 0)';
            this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.strokeStyle = 'rgb(46, 204, 113)';
            this.canvasCtx.beginPath();

            const sliceWidth = this.canvas.width / this.bufferLength;
            let x = 0;

            for (let i = 0; i < this.bufferLength; i++) {
                const v = this.dataArray[i] / 128.0;
                const y = v * this.canvas.height / 2;

                if (i === 0) {
                    this.canvasCtx.moveTo(x, y);
                } else {
                    this.canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            this.canvasCtx.lineTo(this.canvas.width, this.canvas.height / 2);
            this.canvasCtx.stroke();
        };

        draw();
    }

    setupBeatPad() {
        const beatPad = document.getElementById('beatPad');
        const padConfig = [
            // Bird sounds
            { key: 'q', sound: 'chirp', category: 'bird', label: 'Q' },
            { key: 'w', sound: 'whistle', category: 'bird', label: 'W' },
            { key: 'e', sound: 'trill', category: 'bird', label: 'E' },
            { key: 'r', sound: 'tweet', category: 'bird', label: 'R' },
            { key: 'a', sound: 'warble', category: 'bird', label: 'A' },
            { key: 's', sound: 'peep', category: 'bird', label: 'S' },
            { key: 'd', sound: 'coo', category: 'bird', label: 'D' },
            { key: 'f', sound: 'squawk', category: 'bird', label: 'F' },
            // Bass sounds
            { key: 'z', sound: 'bass', category: 'bass', label: 'Z' },
            { key: 'x', sound: 'heavyBass', category: 'bass', label: 'X' },
            { key: 'c', sound: 'subBass', category: 'bass', label: 'C' },
            { key: 'v', sound: 'growl', category: 'bass', label: 'V' }
        ];

        padConfig.forEach((config, index) => {
            const pad = document.createElement('div');
            pad.className = `pad ${config.category}`;
            pad.dataset.key = config.key;
            pad.dataset.sound = config.sound;
            pad.dataset.category = config.category;

            const soundLabel = document.createElement('div');
            soundLabel.className = 'pad-sound';
            soundLabel.textContent = config.sound;

            const keyLabel = document.createElement('div');
            keyLabel.className = 'pad-label';
            keyLabel.textContent = config.label;

            pad.appendChild(soundLabel);
            pad.appendChild(keyLabel);

            pad.addEventListener('mousedown', () => this.triggerPad(pad));
            pad.addEventListener('mouseup', () => this.releasePad(pad));
            pad.addEventListener('mouseleave', () => this.releasePad(pad));

            beatPad.appendChild(pad);
        });

        // Setup pattern controls
        const recordPattern = document.getElementById('recordPattern');
        const playPattern = document.getElementById('playPattern');
        const clearPattern = document.getElementById('clearPattern');

        recordPattern.addEventListener('click', () => this.togglePatternRecording());
        playPattern.addEventListener('click', () => this.togglePatternPlayback());
        clearPattern.addEventListener('click', () => this.clearPattern());
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            const pad = document.querySelector(`.pad[data-key="${key}"]`);
            if (pad) {
                this.triggerPad(pad);
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            const pad = document.querySelector(`.pad[data-key="${key}"]`);
            if (pad) {
                this.releasePad(pad);
            }
        });
    }

    triggerPad(pad) {
        if (!pad.classList.contains('active')) {
            pad.classList.add('active');
            const sound = pad.dataset.sound;
            this.playSound(sound);

            if (this.isRecordingPattern) {
                const time = this.audioContext.currentTime - this.patternStartTime;
                this.pattern.push({
                    time,
                    sound,
                    duration: 0.2 // Default duration
                });
            }
        }
    }

    releasePad(pad) {
        pad.classList.remove('active');
    }

    togglePatternRecording() {
        const recordButton = document.getElementById('recordPattern');
        if (this.isRecordingPattern) {
            this.isRecordingPattern = false;
            recordButton.classList.remove('active');
            recordButton.textContent = 'Record Pattern';
        } else {
            this.isRecordingPattern = true;
            this.pattern = [];
            this.patternStartTime = this.audioContext.currentTime;
            recordButton.classList.add('active');
            recordButton.textContent = 'Stop Recording';
        }
    }

    togglePatternPlayback() {
        const playButton = document.getElementById('playPattern');
        if (this.isPlayingPattern) {
            this.stopPatternPlayback();
            playButton.classList.remove('active');
            playButton.textContent = 'Play Pattern';
        } else {
            this.playPattern();
            playButton.classList.add('active');
            playButton.textContent = 'Stop Pattern';
        }
    }

    playPattern() {
        if (this.pattern.length === 0 || this.isPlayingPattern) return;
        
        this.isPlayingPattern = true;
        const startTime = this.audioContext.currentTime;
        
        this.pattern.forEach(event => {
            const time = startTime + event.time;
            setTimeout(() => {
                const pad = document.querySelector(`.pad[data-sound="${event.sound}"]`);
                if (pad) {
                    this.triggerPad(pad);
                    setTimeout(() => this.releasePad(pad), event.duration * 1000);
                }
            }, event.time * 1000);
        });

        const totalDuration = this.pattern[this.pattern.length - 1].time + this.pattern[this.pattern.length - 1].duration;
        setTimeout(() => {
            this.stopPatternPlayback();
        }, totalDuration * 1000);
    }

    stopPatternPlayback() {
        this.isPlayingPattern = false;
        const playButton = document.getElementById('playPattern');
        playButton.classList.remove('active');
        playButton.textContent = 'Play Pattern';
        
        // Release all pads
        document.querySelectorAll('.pad.active').forEach(pad => {
            this.releasePad(pad);
        });
    }

    clearPattern() {
        this.pattern = [];
        this.stopPatternPlayback();
        const recordButton = document.getElementById('recordPattern');
        recordButton.classList.remove('active');
        recordButton.textContent = 'Record Pattern';
    }
}

// Initialize the synth when the page loads
window.addEventListener('load', () => {
    const synth = new BirdSynth();
}); 