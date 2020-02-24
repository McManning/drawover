// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/extend-expect';

// Test environment initalization for mocking browser
// features we need that aren't in jsdom
import 'jest-canvas-mock'; // Canvas methods
import 'geometry-polyfill'; // DOMMatrix and DOMPoint (although this is implementation, not a mock)

// The polyfill includes methods from both, but only defines DOMMatrix as a class
window.DOMMatrixReadOnly = window.DOMMatrix;

// Web Worker mock
class MockWebWorker {

}

global.Worker = MockWebWorker;
