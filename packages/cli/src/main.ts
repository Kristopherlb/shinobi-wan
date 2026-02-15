#!/usr/bin/env node
import { createCli } from './cli';

createCli().parseAsync(process.argv);
