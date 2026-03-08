# Pulse8 – Haptic Feedback for Gaming Audio

Pulse8 is a system that converts directional in‑game audio into **haptic feedback**, allowing players to physically feel where sounds are coming from. The project is designed specifically for competitive games like Valorant, where spatial audio cues such as footsteps or gunshots provide critical information.
Our goal is to enhance accessibility and situational awareness for deaf and hard-of-hearing (DHH) individuals by translating game audio into directional signals that players can feel.

## Overview

In competitive games like Valorant, audio cues such as footsteps and gunshots provide important information about enemy positions. However, these cues rely heavily on hearing and high‑quality spatial audio. In many cases, relying on only visual cues (like visual-sound effects) is a significant disadvantage
Pulse8 bridges this gap for DHH individuals by converting directional sound into **haptic signals**, allowing players to feel the location of sounds around them.

For example:
- Footsteps behind you → vibration or signal from the back
- Gunshots to the right → feedback on the right side
- Movement above or below → directional signal

This allows deaf and hard-of-hearing players to interpret spatial audio through **touch instead of sound**.

## How It Works

The system processes game audio and converts it into directional feedback.

1. **Audio Input**  
   Stereo game audio is captured from the computer.

2. **Audio Processing**  
   The Pulse8 app analyzes the left and right audio channels to detect important sound events such as footsteps or gunshots.

3. **ESPNOW Communication**  
   The Pulse8 app uses a transmitter ESP32 to send signals to a receiver ESP32, which receives the signals to output on the helmet

4. **Directional Feedback**  
   A microcontroller activates outputs corresponding to 8 spatial directions (hence the name Pulse8)

## Prototype

The current prototype uses:

- **ESP32 microcontroller**
- Directional LED indicators for proof-of-concept { vibrational motors not available for use :( }
- Simulated sound events (footsteps and gunshots)

Each direction has 2 LEDs representing either footsteps or gunshots from in-game audio.
This prototype demonstrates how spatial audio can be translated into tactile or visual signals.

## Accessibility Impact

Pulse8 aims to make competitive gaming more accessible by providing an alternative way to interpret spatial audio.

Potential benefits include:
- Improved accessibility for DHH individuals
- Enhanced spatial awareness for all players
- Additional sensory feedback in competitive gameplay

## Future Work

Possible improvements include:
- Advanced sound classification for more diverse in‑game audios
- Wearable haptic devices (vest, belt, or wristbands)
- Real-world integration (e.g notifying user based on their physical environment while gaming)

## Vision

Pulse8 explores how **haptic technology can expand how players experience sound in games**, creating a new layer of feedback that improves both accessibility and immersion.
