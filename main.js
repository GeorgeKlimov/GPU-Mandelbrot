function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        console.error(source.split("\n").map((e,i)=>(i+1)+": "+e).join("\n"))
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgramShaders(gl, vertexShader, fragmentShader){
    let program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.error(gl.getProgramInfoLog(program))
        return null
    }

    return program
}

function createProgram(gl, vertexShaderSource, fragmentShaderSource){
    let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
    return createProgramShaders(gl, vertexShader, fragmentShader)
}

function createFloatTexture(gl, width, height, data){
    let texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
}

function createUInt8Texture(gl, width, height, data){
    let texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
}

function checkFramebufferStatus(gl) {
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    switch (status) {
        case gl.FRAMEBUFFER_COMPLETE:
            console.log('Framebuffer is complete');
            break;
        case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
            console.log('Attachment is not complete');
            break;
        case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
            console.log('No attachments');
            break;
        case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
            console.log('Attachments dont have the same dimensions');
            break;
        case gl.FRAMEBUFFER_UNSUPPORTED:
            console.log('Format combination is not supported');
            break;
        default:
            console.log('Unknown framebuffer status:', status);
    }
}

let canvas = document.getElementById("simulationCanvas")
canvas.width = 2400
canvas.height = 2400
canvas.style.width = 600 + "px"
canvas.style.height = 600 + "px"
let width = canvas.width
let height = canvas.height
let gl = canvas.getContext('webgl2')

if (!gl.getExtension('OES_texture_float_linear'))
    throw new Error('Not found OES_texture_float_linear')
if (!gl.getExtension('EXT_color_buffer_float'))
    throw new Error('Not found EXT_color_buffer_float')

let VS = `#version 300 es
    precision highp float;
    in vec2 a_position;
    in vec2 a_texCoord;

    out vec2 v_texCoord;

    void main(){
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`

let RFS = `#version 300 es
    precision highp float;

    uniform sampler2D u_texture;
    in vec2 v_texCoord;
    out vec4 fragColor;

    void main(){
        vec4 px = texture(u_texture, v_texCoord);
        if (px.b == 10.0){
            fragColor = vec4 (0.0, 0.0, 0.0, 1.0);
        }
        else{
            fragColor = abs(texture(u_texture, v_texCoord));
        }
    }
`

let UFS = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float steps;
    uniform float l;
    uniform vec2 center;
    out vec4 fragColor;

    vec2 f(vec2 z){
        vec2 z_2 = vec2 (pow(z.x, 2.0) - pow(z.y, 2.0), 2.0 * z.x * z.y);
        return z_2;
    }   

    float mag(vec2 z){
        return pow(pow(z.x, 2.0) + pow(z.y, 2.0), 0.5);
    }

    void main(){
        vec2 c = center + (v_texCoord - 0.5) * l;
        vec4 z = texture(u_texture, v_texCoord);
        if (z.b == 10.0){
            fragColor = z;
            return;
        }
        vec2 new_z = f(z.xy) + c;
        vec4 state;
        for(float i = 0.0; i < steps; i++){
            new_z = f(new_z.xy) + c;
            float z_mag = mag(new_z);
            if (z_mag > 1000.0){
                fragColor = vec4 (0.0, 0.0, 10.0, 1.0);
                break;
            }
        }
        if(fragColor.b == 10.0){
            fragColor = vec4 (0.0, 0.0, 10.0, 1.0);
        }
        else{
            fragColor = vec4(new_z, 1.0, 1.0);
        }
    }
`

class phys419{
    constructor(steps){
        this.canvas = document.getElementById("simulationCanvas")
        this.gl = canvas.getContext('webgl2')

        let gl = this.gl

        canvas.width = 2400
        canvas.height = 2400
        canvas.style.width = 600 + "px"
        canvas.style.height = 600 + "px"

        let data = new Float32Array(this.canvas.width * this.canvas.height * 4)
        
        for (let x = 0; x < width; x++){
            for (let y = 0; y < height; y++){
                let index = (x + width * y) * 4
                data[index] = 0
                data[index + 1] = 0
                data[index + 2] = 0
                data[index + 3] = 1
            }
        }

        this.texture0 = createFloatTexture(gl, width, height, data)
        this.texture1 = createFloatTexture(gl, width, height, data)
        this.renderProgram = createProgram(gl, VS, RFS)
        this.updateProgram = createProgram(gl, VS, UFS)

        this.steps = steps
        this.zoom = 4.0
        this.center = [0.0, 0.0]
        this.xMin = -2.0
        this.yMin = -2.0
        this.l = 4.0

        this.setupBuffers()
        this.framebuffer = gl.createFramebuffer()
        checkFramebufferStatus(gl)

        this.draw(this.texture0)
    }

    resetTextures(){
        let data = new Float32Array(width * height * 4)

        for (let x = 0; x < width; x++){
            for (let y = 0; y < height; y++){
                let index = (x + width * y) * 4
                data[index] = 0
                data[index + 1] = 0
                data[index + 2] = 0
                data[index + 3] = 1
            }
        }

        this.texture0 = createFloatTexture(gl, width, height, data)
        this.texture1 = createFloatTexture(gl, width, height, data)
    }

    setupBuffers() {
        let gl = this.gl

        let positions = [
            -1, -1,  0, 0,
             1, -1,  1, 0,
            -1,  1,  0, 1,
            -1,  1,  0, 1,
             1, -1,  1, 0,
             1,  1,  1, 1
        ]
        this.buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

        this.positionLocation = gl.getAttribLocation(this.renderProgram, "a_position")
        this.texCoordLocation = gl.getAttribLocation(this.renderProgram, "a_texCoord")

        gl.enableVertexAttribArray(this.positionLocation)
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 16, 0)
        gl.enableVertexAttribArray(this.texCoordLocation)
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 16, 8)
    }

    rule(){
        let gl = this.gl

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
        gl.bindTexture(gl.TEXTURE_2D, this.texture1)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture1, 0)

        gl.useProgram(this.updateProgram)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.texture0)

        let u_textureLocation = gl.getUniformLocation(this.updateProgram, "u_texture")
        let stepsLocation = gl.getUniformLocation(this.updateProgram, "steps")
        let lengthLocation = gl.getUniformLocation(this.updateProgram, "l")
        let centerLocation = gl.getUniformLocation(this.updateProgram, "center")

        gl.uniform1i(u_textureLocation, 0)
        gl.uniform1f(stepsLocation, this.steps)
        gl.uniform1f(lengthLocation, this.l)
        gl.uniform2f(centerLocation, this.center[0], this.center[1])

        gl.drawArrays(gl.TRIANGLES, 0, 6)

        let temp = this.texture0
        this.texture0 = this.texture1
        this.texture1 = temp

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    draw(texture){
        let gl = this.gl
        gl.clearColor(0.0, 0.0, 0.0, 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.useProgram(this.renderProgram)

        gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    update(){
        this.rule()
        this.draw(this.texture0)
        // setTimeout(() => this.update(), 1000)
    }
}

let mandelbrot = new phys419(100)
document.addEventListener("DOMContentLoaded", () => {
    
    let canvas = mandelbrot.canvas
    let updateButton = document.getElementById("updateButton")
    let stepsInput = document.getElementById("steps")

    stepsInput.addEventListener("input", (e) => {
        mandelbrot.steps = parseInt(stepsInput.value)
    })

    canvas.addEventListener("contextmenu", (e) => {
        e.preventDefault()
    })

    canvas.addEventListener("mousedown", (e) => {
        if (e.button == 0){
            mandelbrot.resetTextures()
            mandelbrot.l *= 0.9
            let relX = (e.offsetX + 1) / 600
            let relY = 1 - (e.offsetY + 1) / 600
            let l = mandelbrot.l
            mandelbrot.center[0] = mandelbrot.xMin + relX * l
            mandelbrot.center[1] = mandelbrot.yMin + relY * l
            mandelbrot.xMin = (mandelbrot.center[0] - l/2)
            mandelbrot.yMin = (mandelbrot.center[1] - l/2)
            console.log(mandelbrot.center, [mandelbrot.xMin, mandelbrot.xMax], [mandelbrot.yMin, mandelbrot.yMax])
            mandelbrot.update()
        }
        else if (e.button == 2){
            e.preventDefault()
            mandelbrot.resetTextures()
            let relX = (e.offsetX + 1) / 600
            let relY = 1 - (e.offsetY + 1) / 600
            mandelbrot.l /= 0.9
            let l = mandelbrot.l
            mandelbrot.center[0] = mandelbrot.xMin + relX * l
            mandelbrot.center[1] = mandelbrot.yMin + relY * l
            mandelbrot.xMin = (mandelbrot.center[0] - l/2)
            mandelbrot.yMin = (mandelbrot.center[1] - l/2)
            mandelbrot.center = [relX, relY]
            mandelbrot.update()
        }
    })

    updateButton.addEventListener("click", (e) => {
        mandelbrot.update()
    })

})