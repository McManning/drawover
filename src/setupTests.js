
// Test environment initalization for mocking browser
// features we need that aren't in jsdom

import 'jest-canvas-mock'; // Canvas methods
import 'geometry-polyfill'; // DOMMatrix and DOMPoint (although this is implementation, not a mock)

// The polyfill includes methods from both, but only defines DOMMatrix as a class
window.DOMMatrixReadOnly = window.DOMMatrix;

// Mock for the noUiSlider library, since it's not a React component
// (maybe we should import it into the build instead?)
class MockNoUiSlider {
    on() {}
    get() { return 0; }
    set() {}
}

window.noUiSlider = {
    create: (el) => el.noUiSlider = new MockNoUiSlider()
};

// Web Worker mock
class MockWebWorker {

}

global.Worker = MockWebWorker;
