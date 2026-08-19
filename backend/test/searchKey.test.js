const test=require('node:test');const assert=require('node:assert/strict');const{createSearchKey}=require('../src/utils/searchKey');
test('동일 검색 조건을 안정적인 WatchTarget 키로 정규화한다',()=>assert.equal(createSearchKey({origin:' icn ',destination:'nrt',departureDate:'2026-10-10',returnDate:'2026-10-13',tripType:'ROUND',passengers:1}),'ICN#NRT#20261010#20261013#ROUND#1'));
test('편도 키는 귀국일을 포함하지 않는다',()=>assert.equal(createSearchKey({origin:'ICN',destination:'KIX',departureDate:'2026-11-01',returnDate:'2026-12-01',tripType:'ONE_WAY',passengers:2}),'ICN#KIX#20261101##ONE_WAY#2'));
