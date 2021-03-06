/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {illegalArgument, onUnexpectedError} from 'vs/base/common/errors';
import URI from 'vs/base/common/uri';
import {TPromise} from 'vs/base/common/winjs.base';
import {IModel} from 'vs/editor/common/editorCommon';
import {Range} from 'vs/editor/common/core/range';
import {CommonEditorRegistry} from 'vs/editor/common/editorCommonExtensions';
import {CodeLensProviderRegistry, CodeLensProvider, ICodeLensSymbol} from 'vs/editor/common/modes';
import {IModelService} from 'vs/editor/common/services/modelService';
import {asWinJsPromise} from 'vs/base/common/async';

export interface ICodeLensData {
	symbol: ICodeLensSymbol;
	provider: CodeLensProvider;
}

export function getCodeLensData(model: IModel): TPromise<ICodeLensData[]> {

	const symbols: ICodeLensData[] = [];
	const provider = CodeLensProviderRegistry.ordered(model);

	const promises = provider.map(provider => asWinJsPromise(token => provider.provideCodeLenses(model, token)).then(result => {
		if (Array.isArray(result)) {
			for (let symbol of result) {
				symbols.push({ symbol, provider });
			}
		}
	}, onUnexpectedError));

	return TPromise.join(promises).then(() => {
		return symbols.sort((a, b) => {
			// sort by range and provider rank
			let ret = Range.compareRangesUsingStarts(a.symbol.range, b.symbol.range);
			if (ret === 0) {
				ret = provider.indexOf(a.provider) - provider.indexOf(b.provider);
			}
			return ret;
		});
	});
}

CommonEditorRegistry.registerLanguageCommand('_executeCodeLensProvider', function(accessor, args) {

	const {resource} = args;
	if (!(resource instanceof URI)) {
		throw illegalArgument();
	}

	const model = accessor.get(IModelService).getModel(resource);
	if (!model) {
		throw illegalArgument();
	}

	return getCodeLensData(model);
});
