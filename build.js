import { spawn } from 'child_process'
import esbuild from 'esbuild'

let nodeProc = null

esbuild
  .build({
    entryPoints: ['index.ts'],
    outdir: 'dist',
    target: 'node16',
    watch: {
      onRebuild(error, result) {
        if (error) console.error('watch build failed:', error)
        else {
          console.log('Restarting...')
          nodeProc.on('close', () => {
            nodeProc = spawn('node', ['dist/index.js'])
            nodeProc.stdout.pipe(process.stdout)
            nodeProc.stderr.pipe(process.stderr)
          })
          nodeProc.kill()
        }
      },
    },
  })
  .then((result) => {
    nodeProc = spawn('node', ['dist/index.js'])

    nodeProc.stdout.pipe(process.stdout)
    nodeProc.stderr.pipe(process.stderr)
  })
