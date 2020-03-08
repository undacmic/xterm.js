/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE, DEFAULT_ATTR, Content, UnderlineStyle, BgFlags, Attributes, FgFlags } from 'common/buffer/Constants';
import { BufferLine } from 'common/buffer//BufferLine';
import { CellData } from 'common/buffer/CellData';
import { CharData, IBufferLine } from '../Types';
import { assert, expect } from 'chai';
import { AttributeData } from 'common/buffer/AttributeData';


class TestBufferLine extends BufferLine {
  public get combined(): {[index: number]: string} {
    return this._combined;
  }

  public toArray(): CharData[] {
    const result = [];
    for (let i = 0; i < this.length; ++i) {
      result.push(this.loadCell(i, new CellData()).getAsCharData());
    }
    return result;
  }
}

describe('AttributeData', () => {
  describe('extended attributes', () => {
    it('hasExtendedAttrs', () => {
      const attrs = new AttributeData();
      assert.equal(!!attrs.hasExtendedAttrs(), false);
      attrs.bg |= BgFlags.HAS_EXTENDED;
      assert.equal(!!attrs.hasExtendedAttrs(), true);
    });
    it('getUnderlineColor', () => {
      const attrs = new AttributeData();
      attrs.extended.underlineColor = (1 << 16) | (2 << 8) | 3;

      // should use FG color if BgFlags.HAS_EXTENDED is not set
      assert.equal(attrs.getUnderlineColor(), -1);

      // should use underlineColor if BgFlags.HAS_EXTENDED is set and underlineColor holds a value
      attrs.bg |= BgFlags.HAS_EXTENDED;
      assert.equal(attrs.getUnderlineColor(), (1 << 16) | (2 << 8) | 3);

      // should use FG color if underlineColor holds no value
      attrs.extended.underlineColor = -1;
      attrs.fg |= Attributes.CM_P256 | 123;
      assert.equal(attrs.getUnderlineColor(), 123);
    });
    it('getUnderlineStyle', () => {
      const attrs = new AttributeData();

      // defaults to no underline style
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.NONE);

      // should return NONE if UNDERLINE is not set
      attrs.extended.underlineStyle = UnderlineStyle.CURLY;
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.NONE);

      // should return SINGLE style if UNDERLINE is set and HAS_EXTENDED is false
      attrs.fg |= FgFlags.UNDERLINE;
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.SINGLE);

      // should return correct style if both is set
      attrs.bg |= BgFlags.HAS_EXTENDED;
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.CURLY);

      // should return NONE if UNDERLINE is not set, but HAS_EXTENDED is true
      attrs.fg &= ~FgFlags.UNDERLINE;
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.NONE);
    });
  });
});

describe('CellData', () => {
  it('CharData <--> CellData equality', () => {
    const cell = new CellData();
    // ASCII
    cell.setFromCharData([123, 'a', 1, 'a'.charCodeAt(0)]);
    assert.deepEqual(cell.getAsCharData(), [123, 'a', 1, 'a'.charCodeAt(0)]);
    assert.equal(cell.isCombined(), 0);
    // combining
    cell.setFromCharData([123, 'e\u0301', 1, '\u0301'.charCodeAt(0)]);
    assert.deepEqual(cell.getAsCharData(), [123, 'e\u0301', 1, '\u0301'.charCodeAt(0)]);
    assert.equal(cell.isCombined(), Content.IS_COMBINED_MASK);
    // surrogate
    cell.setFromCharData([123, '𝄞', 1, 0x1D11E]);
    assert.deepEqual(cell.getAsCharData(), [123, '𝄞', 1, 0x1D11E]);
    assert.equal(cell.isCombined(), 0);
    // surrogate + combining
    cell.setFromCharData([123, '𓂀\u0301', 1, '𓂀\u0301'.charCodeAt(2)]);
    assert.deepEqual(cell.getAsCharData(), [123, '𓂀\u0301', 1, '𓂀\u0301'.charCodeAt(2)]);
    assert.equal(cell.isCombined(), Content.IS_COMBINED_MASK);
    // wide char
    cell.setFromCharData([123, '１', 2, '１'.charCodeAt(0)]);
    assert.deepEqual(cell.getAsCharData(), [123, '１', 2, '１'.charCodeAt(0)]);
    assert.equal(cell.isCombined(), 0);
  });
});

describe('BufferLine', function(): void {
  it('ctor', function(): void {
    let line: IBufferLine = new TestBufferLine(0);
    expect(line.length).equals(0);
    expect(line.isWrapped).equals(false);
    line = new TestBufferLine(10);
    expect(line.length).equals(10);
    expect(line.loadCell(0, new CellData()).getAsCharData()).eql([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    expect(line.isWrapped).equals(false);
    line = new TestBufferLine(10, undefined, true);
    expect(line.length).equals(10);
    expect(line.loadCell(0, new CellData()).getAsCharData()).eql([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    expect(line.isWrapped).equals(true);
    line = new TestBufferLine(10, CellData.fromCharData([123, 'a', 456, 'a'.charCodeAt(0)]), true);
    expect(line.length).equals(10);
    expect(line.loadCell(0, new CellData()).getAsCharData()).eql([123, 'a', 456, 'a'.charCodeAt(0)]);
    expect(line.isWrapped).equals(true);
  });
  it('insertCells', function(): void {
    const line = new TestBufferLine(3);
    line.setCell(0, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
    line.setCell(1, CellData.fromCharData([2, 'b', 0, 'b'.charCodeAt(0)]));
    line.setCell(2, CellData.fromCharData([3, 'c', 0, 'c'.charCodeAt(0)]));
    line.insertCells(1, 3, CellData.fromCharData([4, 'd', 0, 'd'.charCodeAt(0)]));
    expect(line.toArray()).eql([
      [1, 'a', 0, 'a'.charCodeAt(0)],
      [4, 'd', 0, 'd'.charCodeAt(0)],
      [4, 'd', 0, 'd'.charCodeAt(0)]
    ]);
  });
  it('deleteCells', function(): void {
    const line = new TestBufferLine(5);
    line.setCell(0, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
    line.setCell(1, CellData.fromCharData([2, 'b', 0, 'b'.charCodeAt(0)]));
    line.setCell(2, CellData.fromCharData([3, 'c', 0, 'c'.charCodeAt(0)]));
    line.setCell(3, CellData.fromCharData([4, 'd', 0, 'd'.charCodeAt(0)]));
    line.setCell(4, CellData.fromCharData([5, 'e', 0, 'e'.charCodeAt(0)]));
    line.deleteCells(1, 2, CellData.fromCharData([6, 'f', 0, 'f'.charCodeAt(0)]));
    expect(line.toArray()).eql([
      [1, 'a', 0, 'a'.charCodeAt(0)],
      [4, 'd', 0, 'd'.charCodeAt(0)],
      [5, 'e', 0, 'e'.charCodeAt(0)],
      [6, 'f', 0, 'f'.charCodeAt(0)],
      [6, 'f', 0, 'f'.charCodeAt(0)]
    ]);
  });
  it('replaceCells', function(): void {
    const line = new TestBufferLine(5);
    line.setCell(0, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
    line.setCell(1, CellData.fromCharData([2, 'b', 0, 'b'.charCodeAt(0)]));
    line.setCell(2, CellData.fromCharData([3, 'c', 0, 'c'.charCodeAt(0)]));
    line.setCell(3, CellData.fromCharData([4, 'd', 0, 'd'.charCodeAt(0)]));
    line.setCell(4, CellData.fromCharData([5, 'e', 0, 'e'.charCodeAt(0)]));
    line.replaceCells(2, 4, CellData.fromCharData([6, 'f', 0, 'f'.charCodeAt(0)]));
    expect(line.toArray()).eql([
      [1, 'a', 0, 'a'.charCodeAt(0)],
      [2, 'b', 0, 'b'.charCodeAt(0)],
      [6, 'f', 0, 'f'.charCodeAt(0)],
      [6, 'f', 0, 'f'.charCodeAt(0)],
      [5, 'e', 0, 'e'.charCodeAt(0)]
    ]);
  });
  it('fill', function(): void {
    const line = new TestBufferLine(5);
    line.setCell(0, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
    line.setCell(1, CellData.fromCharData([2, 'b', 0, 'b'.charCodeAt(0)]));
    line.setCell(2, CellData.fromCharData([3, 'c', 0, 'c'.charCodeAt(0)]));
    line.setCell(3, CellData.fromCharData([4, 'd', 0, 'd'.charCodeAt(0)]));
    line.setCell(4, CellData.fromCharData([5, 'e', 0, 'e'.charCodeAt(0)]));
    line.fill(CellData.fromCharData([123, 'z', 0, 'z'.charCodeAt(0)]));
    expect(line.toArray()).eql([
      [123, 'z', 0, 'z'.charCodeAt(0)],
      [123, 'z', 0, 'z'.charCodeAt(0)],
      [123, 'z', 0, 'z'.charCodeAt(0)],
      [123, 'z', 0, 'z'.charCodeAt(0)],
      [123, 'z', 0, 'z'.charCodeAt(0)]
    ]);
  });
  it('clone', function(): void {
    const line = new TestBufferLine(5, undefined, true);
    line.setCell(0, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
    line.setCell(1, CellData.fromCharData([2, 'b', 0, 'b'.charCodeAt(0)]));
    line.setCell(2, CellData.fromCharData([3, 'c', 0, 'c'.charCodeAt(0)]));
    line.setCell(3, CellData.fromCharData([4, 'd', 0, 'd'.charCodeAt(0)]));
    line.setCell(4, CellData.fromCharData([5, 'e', 0, 'e'.charCodeAt(0)]));
    const line2 = line.clone();
    expect(TestBufferLine.prototype.toArray.apply(line2)).eql(line.toArray());
    expect(line2.length).equals(line.length);
    expect(line2.isWrapped).equals(line.isWrapped);
  });
  it('copyFrom', function(): void {
    const line = new TestBufferLine(5);
    line.setCell(0, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
    line.setCell(1, CellData.fromCharData([2, 'b', 0, 'b'.charCodeAt(0)]));
    line.setCell(2, CellData.fromCharData([3, 'c', 0, 'c'.charCodeAt(0)]));
    line.setCell(3, CellData.fromCharData([4, 'd', 0, 'd'.charCodeAt(0)]));
    line.setCell(4, CellData.fromCharData([5, 'e', 0, 'e'.charCodeAt(0)]));
    const line2 = new TestBufferLine(5, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]), true);
    line2.copyFrom(line);
    expect(line2.toArray()).eql(line.toArray());
    expect(line2.length).equals(line.length);
    expect(line2.isWrapped).equals(line.isWrapped);
  });
  it('should support combining chars', function(): void {
    // CHAR_DATA_CODE_INDEX resembles current behavior in InputHandler.print
    // --> set code to the last charCodeAt value of the string
    // Note: needs to be fixed once the string pointer is in place
    const line = new TestBufferLine(2, CellData.fromCharData([1, 'e\u0301', 0, '\u0301'.charCodeAt(0)]));
    expect(line.toArray()).eql([[1, 'e\u0301', 0, '\u0301'.charCodeAt(0)], [1, 'e\u0301', 0, '\u0301'.charCodeAt(0)]]);
    const line2 = new TestBufferLine(5, CellData.fromCharData([1, 'a', 0, '\u0301'.charCodeAt(0)]), true);
    line2.copyFrom(line);
    expect(line2.toArray()).eql(line.toArray());
    const line3 = line.clone();
    expect(TestBufferLine.prototype.toArray.apply(line3)).eql(line.toArray());
  });
  describe('resize', function(): void {
    it('enlarge(false)', function(): void {
      const line = new TestBufferLine(5, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]), false);
      line.resize(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      expect(line.toArray()).eql((Array(10) as any).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('enlarge(true)', function(): void {
      const line = new TestBufferLine(5, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]), false);
      line.resize(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      expect(line.toArray()).eql((Array(10) as any).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('shrink(true) - should apply new size', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]), false);
      line.resize(5, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      expect(line.toArray()).eql((Array(5) as any).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('shrink to 0 length', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]), false);
      line.resize(0, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      expect(line.toArray()).eql((Array(0) as any).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('should remove combining data on replaced cells after shrinking then enlarging', () => {
      const line = new TestBufferLine(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]), false);
      line.set(2, [ 0, '😁', 1, '😁'.charCodeAt(0) ]);
      line.set(9, [ 0, '😁', 1, '😁'.charCodeAt(0) ]);
      expect(line.translateToString()).eql('aa😁aaaaaa😁');
      expect(Object.keys(line.combined).length).eql(2);
      line.resize(5, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      expect(line.translateToString()).eql('aa😁aa');
      line.resize(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      expect(line.translateToString()).eql('aa😁aaaaaaa');
      expect(Object.keys(line.combined).length).eql(1);
    });
  });
  describe('getTrimLength', function(): void {
    it('empty line', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      expect(line.getTrimmedLength()).equal(0);
    });
    it('ASCII', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      expect(line.getTrimmedLength()).equal(3);
    });
    it('surrogate', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, '𝄞', 1, '𝄞'.charCodeAt(0)]));
      expect(line.getTrimmedLength()).equal(3);
    });
    it('combining', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
      expect(line.getTrimmedLength()).equal(3);
    });
    it('fullwidth', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, '１', 2, '１'.charCodeAt(0)]));
      line.setCell(3, CellData.fromCharData([0, '', 0, 0]));
      expect(line.getTrimmedLength()).equal(4); // also counts null cell after fullwidth
    });
  });
  describe('translateToString with and w\'o trimming', function(): void {
    it('empty line', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      expect(line.translateToString(false)).equal('          ');
      expect(line.translateToString(true)).equal('');
    });
    it('ASCII', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(4, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(5, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      expect(line.translateToString(false)).equal('a a aa    ');
      expect(line.translateToString(true)).equal('a a aa');
      expect(line.translateToString(false, 0, 5)).equal('a a a');
      expect(line.translateToString(false, 0, 4)).equal('a a ');
      expect(line.translateToString(false, 0, 3)).equal('a a');
      expect(line.translateToString(true, 0, 5)).equal('a a a');
      expect(line.translateToString(true, 0, 4)).equal('a a ');
      expect(line.translateToString(true, 0, 3)).equal('a a');

    });
    it('surrogate', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, '𝄞', 1, '𝄞'.charCodeAt(0)]));
      line.setCell(4, CellData.fromCharData([1, '𝄞', 1, '𝄞'.charCodeAt(0)]));
      line.setCell(5, CellData.fromCharData([1, '𝄞', 1, '𝄞'.charCodeAt(0)]));
      expect(line.translateToString(false)).equal('a 𝄞 𝄞𝄞    ');
      expect(line.translateToString(true)).equal('a 𝄞 𝄞𝄞');
      expect(line.translateToString(false, 0, 5)).equal('a 𝄞 𝄞');
      expect(line.translateToString(false, 0, 4)).equal('a 𝄞 ');
      expect(line.translateToString(false, 0, 3)).equal('a 𝄞');
      expect(line.translateToString(true, 0, 5)).equal('a 𝄞 𝄞');
      expect(line.translateToString(true, 0, 4)).equal('a 𝄞 ');
      expect(line.translateToString(true, 0, 3)).equal('a 𝄞');
    });
    it('combining', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
      line.setCell(4, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
      line.setCell(5, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
      expect(line.translateToString(false)).equal('a e\u0301 e\u0301e\u0301    ');
      expect(line.translateToString(true)).equal('a e\u0301 e\u0301e\u0301');
      expect(line.translateToString(false, 0, 5)).equal('a e\u0301 e\u0301');
      expect(line.translateToString(false, 0, 4)).equal('a e\u0301 ');
      expect(line.translateToString(false, 0, 3)).equal('a e\u0301');
      expect(line.translateToString(true, 0, 5)).equal('a e\u0301 e\u0301');
      expect(line.translateToString(true, 0, 4)).equal('a e\u0301 ');
      expect(line.translateToString(true, 0, 3)).equal('a e\u0301');
    });
    it('fullwidth', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, '１', 2, '１'.charCodeAt(0)]));
      line.setCell(3, CellData.fromCharData([0, '', 0, 0]));
      line.setCell(5, CellData.fromCharData([1, '１', 2, '１'.charCodeAt(0)]));
      line.setCell(6, CellData.fromCharData([0, '', 0, 0]));
      line.setCell(7, CellData.fromCharData([1, '１', 2, '１'.charCodeAt(0)]));
      line.setCell(8, CellData.fromCharData([0, '', 0, 0]));
      expect(line.translateToString(false)).equal('a １ １１ ');
      expect(line.translateToString(true)).equal('a １ １１');
      expect(line.translateToString(false, 0, 7)).equal('a １ １');
      expect(line.translateToString(false, 0, 6)).equal('a １ １');
      expect(line.translateToString(false, 0, 5)).equal('a １ ');
      expect(line.translateToString(false, 0, 4)).equal('a １');
      expect(line.translateToString(false, 0, 3)).equal('a １');
      expect(line.translateToString(false, 0, 2)).equal('a ');
      expect(line.translateToString(true, 0, 7)).equal('a １ １');
      expect(line.translateToString(true, 0, 6)).equal('a １ １');
      expect(line.translateToString(true, 0, 5)).equal('a １ ');
      expect(line.translateToString(true, 0, 4)).equal('a １');
      expect(line.translateToString(true, 0, 3)).equal('a １');
      expect(line.translateToString(true, 0, 2)).equal('a ');
    });
    it('space at end', function(): void {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(4, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(5, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(6, CellData.fromCharData([1, ' ', 1, ' '.charCodeAt(0)]));
      expect(line.translateToString(false)).equal('a a aa    ');
      expect(line.translateToString(true)).equal('a a aa ');
    });
    it('should always return some sane value', function(): void {
      // sanity check - broken line with invalid out of bound null width cells
      // this can atm happen with deleting/inserting chars in inputhandler by "breaking"
      // fullwidth pairs --> needs to be fixed after settling BufferLine impl
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      expect(line.translateToString(false)).equal('          ');
      expect(line.translateToString(true)).equal('');
    });
    it('should work with endCol=0', () => {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      expect(line.translateToString(true, 0, 0)).equal('');
    });
  });
  describe('addCharToCell', () => {
    it('should set width to 1 for empty cell', () => {
      const line = new TestBufferLine(3, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.addCodepointToCell(0, '\u0301'.charCodeAt(0));
      const cell = line.loadCell(0, new CellData());
      // chars contains single combining char
      // width is set to 1
      assert.deepEqual(cell.getAsCharData(), [DEFAULT_ATTR, '\u0301', 1, 0x0301]);
      // do not account a single combining char as combined
      assert.equal(cell.isCombined(), 0);
    });
    it('should add char to combining string in cell', () => {
      const line = new TestBufferLine(3, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      const cell = line .loadCell(0, new CellData());
      cell.setFromCharData([123, 'e\u0301', 1, 'e\u0301'.charCodeAt(1)]);
      line.setCell(0, cell);
      line.addCodepointToCell(0, '\u0301'.charCodeAt(0));
      line.loadCell(0, cell);
      // chars contains 3 chars
      // width is set to 1
      assert.deepEqual(cell.getAsCharData(), [123, 'e\u0301\u0301', 1, 0x0301]);
      // do not account a single combining char as combined
      assert.equal(cell.isCombined(), Content.IS_COMBINED_MASK);
    });
    it('should create combining string on taken cell', () => {
      const line = new TestBufferLine(3, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      const cell = line .loadCell(0, new CellData());
      cell.setFromCharData([123, 'e', 1, 'e'.charCodeAt(1)]);
      line.setCell(0, cell);
      line.addCodepointToCell(0, '\u0301'.charCodeAt(0));
      line.loadCell(0, cell);
      // chars contains 2 chars
      // width is set to 1
      assert.deepEqual(cell.getAsCharData(), [123, 'e\u0301', 1, 0x0301]);
      // do not account a single combining char as combined
      assert.equal(cell.isCombined(), Content.IS_COMBINED_MASK);
    });
  });
  describe('correct fullwidth handling', () => {
    function populate(line: BufferLine): void {
      const cell = CellData.fromCharData([1, '￥', 2, '￥'.charCodeAt(0)]);
      for (let i = 0; i < line.length; i += 2) {
        line.setCell(i, cell);
      }
    }
    it('insert - wide char at pos', () => {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.insertCells(9, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), '￥￥￥￥ a');
      line.insertCells(8, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), '￥￥￥￥a ');
      line.insertCells(1, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' a ￥￥￥a');
    });
    it('insert - wide char at end', () => {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.insertCells(0, 3, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaa￥￥￥ ');
      line.insertCells(4, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaa a ￥￥');
      line.insertCells(4, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaa aa ￥ ');
    });
    it('delete', () => {
      const line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.deleteCells(0, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' ￥￥￥￥a');
      line.deleteCells(5, 2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' ￥￥￥aaa');
      line.deleteCells(0, 2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' ￥￥aaaaa');
    });
    it('replace - start at 0', () => {
      let line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'a ￥￥￥￥');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aa￥￥￥￥');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 3, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaa ￥￥￥');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 8, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaaaaaaa￥');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 9, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaaaaaaaa ');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 10, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaaaaaaaaa');
    });
    it('replace - start at 1', () => {
      let line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' a￥￥￥￥');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 3, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aa ￥￥￥');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 4, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aaa￥￥￥');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 8, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aaaaaaa￥');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 9, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aaaaaaaa ');
      line = new TestBufferLine(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 10, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aaaaaaaaa');
    });
  });
  describe('extended attributes', () => {
    it('setCells', function(): void {
      const line = new TestBufferLine(5);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      // no eAttrs
      line.setCell(0, cell);

      // some underline style
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.setCell(1, cell);

      // same eAttr, different codepoint
      cell.content = 65;  // 'A'
      line.setCell(2, cell);

      // different eAttr
      cell.extended = cell.extended.clone();
      cell.extended.underlineStyle = UnderlineStyle.DOTTED;
      line.setCell(3, cell);

      // no eAttrs again
      cell.bg &= ~BgFlags.HAS_EXTENDED;
      line.setCell(4, cell);

      assert.deepEqual(line.toArray(), [
        [1, 'a', 0, 'a'.charCodeAt(0)],
        [1, 'a', 0, 'a'.charCodeAt(0)],
        [1, 'A', 0, 'A'.charCodeAt(0)],
        [1, 'A', 0, 'A'.charCodeAt(0)],
        [1, 'A', 0, 'A'.charCodeAt(0)]
      ]);
      assert.equal((line as any)._extendedAttrs[0], undefined);
      assert.equal((line as any)._extendedAttrs[1].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[2].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[3].underlineStyle, UnderlineStyle.DOTTED);
      assert.equal((line as any)._extendedAttrs[4], undefined);
      // should be ref to the same object
      assert.equal((line as any)._extendedAttrs[1], (line as any)._extendedAttrs[2]);
      // should be a different obj
      assert.notEqual((line as any)._extendedAttrs[1], (line as any)._extendedAttrs[3]);
    });
    it('loadCell', () => {
      const line = new TestBufferLine(5);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      // no eAttrs
      line.setCell(0, cell);

      // some underline style
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.setCell(1, cell);

      // same eAttr, different codepoint
      cell.content = 65;  // 'A'
      line.setCell(2, cell);

      // different eAttr
      cell.extended = cell.extended.clone();
      cell.extended.underlineStyle = UnderlineStyle.DOTTED;
      line.setCell(3, cell);

      // no eAttrs again
      cell.bg &= ~BgFlags.HAS_EXTENDED;
      line.setCell(4, cell);

      const cell0 = new CellData();
      line.loadCell(0, cell0);
      const cell1 = new CellData();
      line.loadCell(1, cell1);
      const cell2 = new CellData();
      line.loadCell(2, cell2);
      const cell3 = new CellData();
      line.loadCell(3, cell3);
      const cell4 = new CellData();
      line.loadCell(4, cell4);

      assert.equal(cell0.extended.underlineStyle, UnderlineStyle.NONE);
      assert.equal(cell1.extended.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(cell2.extended.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(cell3.extended.underlineStyle, UnderlineStyle.DOTTED);
      assert.equal(cell4.extended.underlineStyle, UnderlineStyle.NONE);
      assert.equal(cell1.extended, cell2.extended);
      assert.notEqual(cell2.extended, cell3.extended);
    });
    it('fill', () => {
      const line = new TestBufferLine(3);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.fill(cell);
      assert.equal((line as any)._extendedAttrs[0].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[1].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[2].underlineStyle, UnderlineStyle.CURLY);
    });
    it('insertCells', () => {
      const line = new TestBufferLine(5);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.insertCells(1, 3, cell);
      assert.equal((line as any)._extendedAttrs[1].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[2].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[3].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[4], undefined);
      cell.extended = cell.extended.clone();
      cell.extended.underlineStyle = UnderlineStyle.DOTTED;
      line.insertCells(2, 2, cell);
      assert.equal((line as any)._extendedAttrs[1].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[2].underlineStyle, UnderlineStyle.DOTTED);
      assert.equal((line as any)._extendedAttrs[3].underlineStyle, UnderlineStyle.DOTTED);
      assert.equal((line as any)._extendedAttrs[4].underlineStyle, UnderlineStyle.CURLY);
    });
    it('deleteCells', () => {
      const line = new TestBufferLine(5);
      const fillCell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      fillCell.extended.underlineStyle = UnderlineStyle.CURLY;
      fillCell.bg |= BgFlags.HAS_EXTENDED;
      line.fill(fillCell);
      fillCell.extended = fillCell.extended.clone();
      fillCell.extended.underlineStyle = UnderlineStyle.DOUBLE;
      line.deleteCells(1, 3, fillCell);
      assert.equal((line as any)._extendedAttrs[0].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[1].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[2].underlineStyle, UnderlineStyle.DOUBLE);
      assert.equal((line as any)._extendedAttrs[3].underlineStyle, UnderlineStyle.DOUBLE);
      assert.equal((line as any)._extendedAttrs[4].underlineStyle, UnderlineStyle.DOUBLE);
    });
    it('replaceCells', () => {
      const line = new TestBufferLine(5);
      const fillCell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      fillCell.extended.underlineStyle = UnderlineStyle.CURLY;
      fillCell.bg |= BgFlags.HAS_EXTENDED;
      line.fill(fillCell);
      fillCell.extended = fillCell.extended.clone();
      fillCell.extended.underlineStyle = UnderlineStyle.DOUBLE;
      line.replaceCells(1, 3, fillCell);
      assert.equal((line as any)._extendedAttrs[0].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[1].underlineStyle, UnderlineStyle.DOUBLE);
      assert.equal((line as any)._extendedAttrs[2].underlineStyle, UnderlineStyle.DOUBLE);
      assert.equal((line as any)._extendedAttrs[3].underlineStyle, UnderlineStyle.CURLY);
      assert.equal((line as any)._extendedAttrs[4].underlineStyle, UnderlineStyle.CURLY);
    });
    it('clone', () => {
      const line = new TestBufferLine(5);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      // no eAttrs
      line.setCell(0, cell);

      // some underline style
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.setCell(1, cell);

      // same eAttr, different codepoint
      cell.content = 65;  // 'A'
      line.setCell(2, cell);

      // different eAttr
      cell.extended = cell.extended.clone();
      cell.extended.underlineStyle = UnderlineStyle.DOTTED;
      line.setCell(3, cell);

      // no eAttrs again
      cell.bg &= ~BgFlags.HAS_EXTENDED;
      line.setCell(4, cell);

      const nLine = line.clone();
      assert.equal((nLine as any)._extendedAttrs[0], (line as any)._extendedAttrs[0]);
      assert.equal((nLine as any)._extendedAttrs[1], (line as any)._extendedAttrs[1]);
      assert.equal((nLine as any)._extendedAttrs[2], (line as any)._extendedAttrs[2]);
      assert.equal((nLine as any)._extendedAttrs[3], (line as any)._extendedAttrs[3]);
      assert.equal((nLine as any)._extendedAttrs[4], (line as any)._extendedAttrs[4]);
    });
    it('copyFrom', () => {
      const initial = new TestBufferLine(5);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      // no eAttrs
      initial.setCell(0, cell);

      // some underline style
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      initial.setCell(1, cell);

      // same eAttr, different codepoint
      cell.content = 65;  // 'A'
      initial.setCell(2, cell);

      // different eAttr
      cell.extended = cell.extended.clone();
      cell.extended.underlineStyle = UnderlineStyle.DOTTED;
      initial.setCell(3, cell);

      // no eAttrs again
      cell.bg &= ~BgFlags.HAS_EXTENDED;
      initial.setCell(4, cell);

      const line = new TestBufferLine(5);
      line.fill(CellData.fromCharData([1, 'b', 0, 'b'.charCodeAt(0)]));
      line.copyFrom(initial);
      assert.equal((line as any)._extendedAttrs[0], (initial as any)._extendedAttrs[0]);
      assert.equal((line as any)._extendedAttrs[1], (initial as any)._extendedAttrs[1]);
      assert.equal((line as any)._extendedAttrs[2], (initial as any)._extendedAttrs[2]);
      assert.equal((line as any)._extendedAttrs[3], (initial as any)._extendedAttrs[3]);
      assert.equal((line as any)._extendedAttrs[4], (initial as any)._extendedAttrs[4]);
    });
  });
});
