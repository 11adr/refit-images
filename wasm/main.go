//go:build js && wasm

// Command main exposes the caire seam carving engine to JavaScript.
// Everything runs client side inside the visitor's browser.
package main

import (
	"errors"
	"image"
	"syscall/js"

	"github.com/11adr/refit-images/wasm/caire"
)

// caireResize(pixels, width, height, options, onProgress) -> Uint8ClampedArray | throws
//
// pixels:  Uint8ClampedArray, RGBA, len = width*height*4
// options: { width, height, sobel, blur, faces, protect?, remove?, total }
// protect / remove: optional Uint8ClampedArray masks (RGBA, white = painted).
func resize(this js.Value, args []js.Value) (result any) {
	defer func() {
		if r := recover(); r != nil {
			result = map[string]any{"error": "internal error while carving"}
		}
	}()

	w, h := args[1].Int(), args[2].Int()
	opts := args[3]
	onProgress := args[4]

	img := fromJS(args[0], w, h)
	p := &caire.Processor{
		NewWidth:       opts.Get("width").Int(),
		NewHeight:      opts.Get("height").Int(),
		SobelThreshold: opts.Get("sobel").Int(),
		BlurRadius:     opts.Get("blur").Int(),
		FaceDetect:     opts.Get("faces").Bool(),
		FaceAngle:      0,
	}
	if m := opts.Get("protect"); m.Truthy() {
		p.Mask = fromJS(m, w, h)
	}
	if m := opts.Get("remove"); m.Truthy() {
		p.RMask = fromJS(m, w, h)
	}

	done := 0
	p.OnSeam = func() error {
		done++
		// A JS-side `cancelled` flag is not needed: the worker is terminated on cancel.
		onProgress.Invoke(done)
		return nil
	}

	out, err := p.Resize(img)
	if err != nil {
		return map[string]any{"error": err.Error()}
	}
	nrgba, ok := out.(*image.NRGBA)
	if !ok {
		return map[string]any{"error": errors.New("unexpected image type").Error()}
	}

	b := nrgba.Bounds()
	arr := js.Global().Get("Uint8ClampedArray").New(b.Dx() * b.Dy() * 4)
	js.CopyBytesToJS(arr, nrgba.Pix)
	return map[string]any{"pixels": arr, "width": b.Dx(), "height": b.Dy()}
}

func fromJS(v js.Value, w, h int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	js.CopyBytesToGo(img.Pix, v)
	return img
}

func main() {
	js.Global().Set("caireResize", js.FuncOf(resize))
	js.Global().Set("caireReady", true)
	select {} // keep the Go runtime alive
}
