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
        this.recordingStartTime = 0;
        this.recordingEvents = [];
        this.currentPlayback = null;
        this.activeOscillators = new Set();
        
        this.setupCanvas();
        this.setupControls();
        this.setupAudioNodes();
        this.setupRecordingControls();
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
        
        const recordingInfo = document.createElement('span');
        recordingInfo.textContent = `Recording ${this.recordings.length} (${recording.duration.toFixed(2)}s)`;
        
        const playButton = document.createElement('button');
        playButton.textContent = 'Play';
        playButton.addEventListener('click', () => this.playRecording(this.recordings.length - 1));
        
        recordingItem.appendChild(recordingInfo);
        recordingItem.appendChild(playButton);
        this.recordingList.appendChild(recordingItem);
    }

    createOscillator() {
        const oscillator = this.audioContext.createOscillator();
        const modulator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const modGain = this.audioContext.createGain();

        modulator.connect(modGain);
        modGain.connect(oscillator.frequency);
        oscillator.connect(gainNode);
        gainNode.connect(this.analyser);

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

        const startTime = this.audioContext.currentTime;
        
        recording.events.forEach(event => {
            const { oscillator, modulator, gainNode, modGain } = this.createOscillator();
            
            const time = startTime + event.time;
            oscillator.frequency.setValueAtTime(event.frequency, time);
            modulator.frequency.setValueAtTime(event.modulationFrequency, time);
            modGain.gain.setValueAtTime(event.modulation, time);
            
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(1, time + event.attack);
            gainNode.gain.linearRampToValueAtTime(0, time + event.attack + event.release);

            oscillator.start(time);
            modulator.start(time);
        });

        this.currentPlayback = setTimeout(() => {
            this.stopPlayback();
        }, (recording.duration + 1) * 1000);
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
        this.isPlaying = false;
        this.playButton.classList.remove('playing');
        this.playButton.textContent = 'Play';
        this.cleanupOscillators();
    }

    clearRecordings() {
        this.recordings = [];
        this.recordingList.innerHTML = '';
        this.stopPlayback();
    }

    playSound(type) {
        const frequency = parseFloat(this.sliders.frequency.value);
        const modulation = parseFloat(this.sliders.modulation.value);
        const attack = parseFloat(this.sliders.attack.value);
        const release = parseFloat(this.sliders.release.value);
        const modulationFrequency = this.getModulationFrequency(type);

        const { oscillator, modulator, gainNode, modGain } = this.createOscillator();

        const time = this.audioContext.currentTime;
        oscillator.frequency.setValueAtTime(frequency, time);
        modulator.frequency.setValueAtTime(modulationFrequency, time);
        modGain.gain.setValueAtTime(modulation, time);

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
                release
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
}

// Initialize the synth when the page loads
window.addEventListener('load', () => {
    const synth = new BirdSynth();
}); 