///<reference path='../resources/jest.d.ts'/>
///<reference path='../dist/Immutable.d.ts'/>

jest.autoMockOff();

import Immutable = require('immutable');
import Map = Immutable.Map;

jasmine.getEnv().addEqualityTester((a, b) =>
  a instanceof Immutable.Sequence && b instanceof Immutable.Sequence ?
    Immutable.is(a, b) :
    jasmine.undefined
);

describe('Cursor', () => {

  var json = { a: { b: { c: 1 } } };

  it('gets from its path', () => {
    var data = Immutable.fromJS(json);
    var cursor = data.cursor();

    expect(Immutable.unCursor(cursor)).toBe(data);

    var deepCursor = cursor.cursor(['a', 'b']);
    expect(deepCursor.toJS()).toEqual(json.a.b);
    expect(deepCursor).toEqual(data.getIn(['a', 'b']));
    expect(deepCursor.get('c')).toBe(1);

    var leafCursor = deepCursor.cursor('c');
    expect(leafCursor).toBe(1);

    var missCursor = deepCursor.cursor('d');
    expect(Immutable.is(missCursor, Map.empty())).toBe(true);
    expect(Immutable.unCursor(missCursor)).toEqual(Map.empty());
  });

  it('appears to be the type it points to', () => {
    var data = Immutable.fromJS({a:[1,2,3]});
    var cursor = data.cursor();
    var aCursor = cursor.cursor('a');
    expect(cursor instanceof Immutable.Map).toBe(true);
    expect(aCursor instanceof Immutable.Vector).toBe(true);
    expect(
      aCursor.update(() => Immutable.Set.empty()) instanceof Immutable.Set
    ).toBe(true);
    expect(
      aCursor.update(() => Immutable.Stack.empty()) instanceof Immutable.Stack
    ).toBe(true);
  });

  it('can detect cursors', () => {
    var data = Immutable.fromJS(json);
    expect(Immutable.isCursor(data.get('a'))).toBe(false);
    expect(Immutable.isCursor(data.cursor('a'))).toBe(true);
  });

  it('gets return new cursors', () => {
    var data = Immutable.fromJS(json);
    var cursor = data.cursor();
    var deepCursor = cursor.getIn(['a', 'b']);
    expect(Immutable.unCursor(deepCursor)).toBe(data.getIn(['a', 'b']));
  });

  it('can be treated as a value', () => {
    var data = Immutable.fromJS(json);
    var cursor = data.cursor(['a', 'b']);
    expect(cursor.toJS()).toEqual(json.a.b);
    expect(cursor).toEqual(data.getIn(['a', 'b']));
    expect(cursor.length).toBe(1);
    expect(cursor.get('c')).toBe(1);
  });

  it('returns scalars directly', () => {
    var data = Immutable.Map({ a: 'A' });
    var aCursor = data.cursor('a');
    expect(aCursor).toBe('A');
  });

  it('updates at its path', () => {
    var onChange = jest.genMockFunction();

    var data = Immutable.fromJS(json);
    var aCursor = data.cursor('a', onChange);

    var deepCursor = aCursor.cursor('b');
    expect(deepCursor.get('c')).toBe(1);

    // cursor edits return new cursors:
    var newDeepCursor = deepCursor.update('c', x => x + 1);
    expect(newDeepCursor.get('c')).toBe(2);

    expect(onChange).lastCalledWith(
      Immutable.fromJS({a:{b:{c:2}}}),
      data,
      ['a', 'b', 'c']
    );

    var newestDeepCursor = newDeepCursor.update('c', x => x + 1);
    expect(newestDeepCursor.get('c')).toBe(3);
    expect(onChange).lastCalledWith(
      Immutable.fromJS({a:{b:{c:3}}}),
      Immutable.fromJS({a:{b:{c:2}}}),
      ['a', 'b', 'c']
    );

    // meanwhile, data is still immutable:
    expect(data.toJS()).toEqual(json);

    // as is the original cursor.
    expect(deepCursor.get('c')).toBe(1);
    var otherNewDeepCursor = deepCursor.update('c', x => x + 10);
    expect(otherNewDeepCursor.get('c')).toBe(11);
    expect(onChange).lastCalledWith(
      Immutable.fromJS({a:{b:{c:11}}}),
      data,
      ['a', 'b', 'c']
    );

    // and update has been called exactly thrice.
    expect(onChange.mock.calls.length).toBe(3);
  });

  it('has map API for update shorthand', () => {
    var onChange = jest.genMockFunction();

    var data = Immutable.fromJS(json);
    var aCursor = data.cursor('a', onChange);
    var bCursor = aCursor.cursor('b');
    var cCursor = bCursor.cursor('c');

    expect(bCursor.set('c', 10)).toEqual(
      Immutable.fromJS({ c: 10 })
    );
    expect(onChange).lastCalledWith(
      Immutable.fromJS({ a: { b: { c: 10 } } }),
      data,
      ['a', 'b', 'c']
    );
  });

  it('creates maps as necessary', () => {
    var data = Immutable.Map();
    var cursor = data.cursor(['a', 'b', 'c']);
    expect(cursor).toEqual(Map.empty());
    cursor = cursor.set('d', 3);
    expect(cursor).toEqual(Immutable.Map({d: 3}));
  });

  it('has the sequence API', () => {
    var data = Immutable.Map({a: 1, b: 2, c: 3});
    var cursor = data.cursor();
    expect(cursor.map(x => x * x)).toEqual(Immutable.Map({a: 1, b: 4, c: 9}));
  });

  it('returns wrapped values for sequence API', () => {
    var data = Immutable.fromJS({a: {v: 1}, b: {v: 2}, c: {v: 3}});
    var onChange = jest.genMockFunction();
    var cursor = data.cursor(onChange);
    var found = cursor.find(map => map.get('v') === 2);
    expect(Immutable.isCursor(found)).toBe(true);
    found = found.set('v', 20);
    expect(onChange).lastCalledWith(
      Immutable.fromJS({a: {v: 1}, b: {v: 20}, c: {v: 3}}),
      data,
      ['b', 'v']
    );
  });

  it('can have mutations apply with a single callback', () => {
    var onChange = jest.genMockFunction();
    var data = Immutable.fromJS({'a': 1});

    var c1 = data.cursor(onChange);
    var c2 = c1.withMutations(m => m.set('b', 2).set('c', 3).set('d', 4));

    expect(c1.toObject()).toEqual({'a': 1});
    expect(c2.toObject()).toEqual({'a': 1, 'b': 2, 'c': 3, 'd': 4});
    expect(onChange.mock.calls.length).toBe(1);
  });

  it('can use withMutations on an unfulfilled cursor', () => {
    var onChange = jest.genMockFunction();
    var data = Immutable.fromJS({});

    var c1 = data.cursor(['a', 'b', 'c'], onChange);
    var c2 = c1.withMutations(m => m.set('x', 1).set('y', 2).set('z', 3));

    expect(c1).toEqual(Map.empty());
    expect(c2).toEqual(Immutable.fromJS(
      { x: 1, y: 2, z: 3 }
    ));
    expect(onChange.mock.calls.length).toBe(1);
  });

  it('can create sub-cursors', () => {
    var onChange = jest.genMockFunction();
    var data = Immutable.fromJS(json);

    var cursorA = data.cursor('a', onChange);
    var cursorAB = cursorA.cursor('b', onChange);

    cursorAB.update('c', v => v + 1);

    expect(data.getIn(['a', 'b', 'c'])).toBe(1); // persistent

    expect(onChange.mock.calls).toEqual([
      [
        Immutable.fromJS({ a: { b: { c: 2 } } }),
        Immutable.fromJS({ a: { b: { c: 1 } } }),
        [ 'a', 'b', 'c' ]
      ],
      [
        Immutable.fromJS({ b: { c: 2 } }),
        Immutable.fromJS({ b: { c: 1 } }),
        [ 'b', 'c' ]
      ]
    ]);
  });

});
