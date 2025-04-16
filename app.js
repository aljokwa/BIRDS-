class BirdSynth {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        
        this.setupCanvas();
        this.setupControls();
        this.setupAudioNodes();
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

    playSound(type) {
        const frequency = parseFloat(this.sliders.frequency.value);
        const modulation = parseFloat(this.sliders.modulation.value);
        const attack = parseFloat(this.sliders.attack.value);
        const release = parseFloat(this.sliders.release.value);

        this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        this.modulator.frequency.setValueAtTime(this.getModulationFrequency(type), this.audioContext.currentTime);
        this.modGain.gain.setValueAtTime(modulation, this.audioContext.currentTime);

        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + attack);

        this.oscillator.start();
        this.modulator.start();
        this.visualize();
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