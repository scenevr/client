import greedy from 'greedy-mesher';
import CANNON from 'cannon';
import Box from 'primitive-cube';

const STATIC_BODY = { mass: 0 };

const mesher = greedy({
  order: [0, 1, 2],
  extraArgs: 1,
  skip: (value) => value <= 0,
  merge: (a, b) => a > 0 && b > 0,
  append: function (xlo, ylo, zlo, xhi, yhi, zhi, val, output) {
    const mesh = Box(1)
    const xd = xhi - xlo
    const yd = yhi - ylo
    const zd = zhi - zlo

    const pos = mesh.positions

    for (var i = 0; i < pos.length; i++) {
      pos[i][0] = pos[i][0] === -0.5 ? xlo : xhi
      pos[i][1] = pos[i][1] === -0.5 ? ylo : yhi
      pos[i][2] = pos[i][2] === -0.5 ? zlo : zhi
    }

    // Physics
    const ppos = [
      (xlo + xhi) / 2,
      (ylo + yhi) / 2,
      (zlo + zhi) / 2
    ]
    
    const pmesh = new CANNON.Box(new CANNON.Vec3(xd/2, yd/2, zd/2))
    const physics = {
      mesh: pmesh,
      pos: ppos
    }

    output.push({ mesh, physics });
  }
})

export default function generate (array) {
  const output = [];

  mesher(array, output);

  const body = new CANNON.Body(STATIC_BODY);

  for (let i = 0; i < output.length; i++) {
    const {mesh, pos} = output[i].physics;

    console.log(pos);

    body.addShape(mesh, new CANNON.Vec3(
      pos[0],
      pos[1],
      pos[2]
    ));
  }

  body.position.set(0, 0, 0);

  return body;
}
