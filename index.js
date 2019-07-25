(async () => {
  const {
    gitUrl,
    dev,
    branchPrefixList,
    push,
    masterBranch
  } = require("minimist")(process.argv.slice(2), {
    boolean: ["dev", "push"],
    default: {
      gitUrl: "",
      dev: false,
      push: false,
      branchPrefixList: "",
      masterBranch: ""
    }
  });

  const exec = require("child_process").exec;
  const semver = require("semver");

  const TEST_BRANCH_NAMES = [
    "release_test",
    "support_test",
    "hotfix_test",
    "warmfix_test",
    "path_test"
  ];

  const prefixGitRef = branchName => `refs/remotes/origin/${branchName}`;

  const getStringBranchNames = branchNames => branchNames.join(" ");

  const getBranchPrefixList = () => branchPrefixList.split(" ");

  const composeP = (...fns) => input =>
    fns.reduceRight((acc, fn) => acc.then(fn), Promise.resolve(input));

  const execPromise = command =>
    new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject({ error });
          return;
        }

        resolve({ stdout });
      });
    });

  /**
   * Get a list of all the existing branches on your repo
   * You can pass the --dev env flag to only pull in specific test branches,
   * You could pass in the --branchPrefixList followed by a space delimited list of branches
   * to scope your merge
   *
   * @returns {Array.<String>} []
   * @example ['release/v2.0.0', 'support/v1.0.0']
   */
  const getBranchNames = async () => {
    // TODO: really needs some refactoring, maybe using compose and a curried map would clean it up later
    const branchNames = dev
      ? getStringBranchNames(
          TEST_BRANCH_NAMES.map(branchName => prefixGitRef(branchName))
        )
      : getStringBranchNames(
          getBranchPrefixList().map(branchName => prefixGitRef(branchName))
        );
    const { stdout } = await execPromise(
      `git for-each-ref --format='%(refname:short)' --sort=v:refname ${branchNames}`
    );

    return stdout.trim().split("\n");
  };

  const removeOriginPrefix = branches =>
    branches.map(branchName => branchName.replace("origin/", ""));

  /**
   * Takes the branch name and splits it into version and name
   *
   * @param {Array} [branches] list of branches
   * @returns {Array.<Object>} [{}]
   * @example [{version: 'v1.0.0', name: 'release', branch: 'release/v1.0.0'}]
   */
  const getBranchVersionMap = branchNames =>
    branchNames.reduce((acc, branch) => {
      const version = branch.substring(branch.indexOf("/") + 1).trim();
      const name = branch.substring(0, branch.indexOf("/")).trim();

      return [...acc, { version, name, branch }];
    }, []);

  /**
   *  Sets up strategy to ignore any confict for the files defined on the
   *  .gitattributes file. If there is a conflict, it will resolve it by taking the
   *  version that exists on the source branch
   */
  const setupMergeStrategy = async () => {
    const { error } = await execPromise("git config merge.ours.driver true");
    if (error) {
      process.exit(1);
    }
  };

  /**
   * Returns the object containing the branch that will be merged into.
   * The last branch will always be mergedi nto the designated master branch for the repo.
   * For example, the highest version of all your branches will be merged into your master branch
   *
   * @param {Array} [branchMaps] branchMap object
   * @returns {Array.<Object>} [{}]
   * @example [{version: 'v1.0.0', name: 'release', mergeInto: 'develop'}]
   */
  const getBranchMergeMap = branchMap =>
    branchMap.reduce((acc, branchObj, index) => {
      if (index + 1 < branchMap.length) {
        return [
          ...acc,
          { ...branchObj, mergeInto: branchMap[index + 1].branch }
        ];
      } else if (index === branchMap.length - 1) {
        return [...acc, { ...branchObj, mergeInto: masterBranch }];
      }
      return acc;
    }, []);

  /**
   * Sorts the branches by their version from smallest to largest. Uses the semver greater than and less
   * than methods to accurately tell which one is higher than the other (its what npm uses :D)
   *
   * @param {Array} [branchMap] branch map
   * @returns {Int} result
   * @example 'v1.0.0 -> v1.0.1 -> v2.0.0 -> v2.0.0'
   */
  const sortByBranchVersion = branchMaps =>
    branchMaps.sort((a, b) => {
      if (semver.gt(a.version, b.version)) {
        return 1;
      }

      if (semver.lt(a.version, b.version)) {
        return -1;
      }
      return 0;
    });

  /**
   * Filters the branch name by the following convention: name/v[0-9].[0-9].[0-9]
   *
   * @param {Array} [branches] list of branches
   * @returns {Array.<String>} []
   * @example ['release/v3.2.0', 'support/v2.0.0']
   */
  const filterBranchNames = branchNames =>
    branchNames.filter(item => item.match(/(\w)*\/v(.*)/));

  const pushBranch = async branch => {
    if (!push) {
      console.info(`[DRY-RUN]: Pushing ${branch}`);
      return;
    }

    const { error } = await execPromise(`git push origin ${branch}`);

    if (error) {
      console.error(error);
    }
  };

  const mergeWorkflow = async branchMergeMap => {
    /* eslint-disable no-await-in-loop */
    for (const branchMap of branchMergeMap) {
      if (!push) {
        console.info("[DRY-RUN]: git fetch -p");
        console.info(
          `[DRY-RUN]: git checkout ${branchMap.branch} && git pull origin ${
            branchMap.branch
          }`
        );
        console.info(
          `[DRY-RUN]: git checkout ${branchMap.mergeInto} && git pull origin ${
            branchMap.mergeInto
          }`
        );
        console.info(
          `[DRY-RUN]: Merging ${branchMap.branch} -> ${branchMap.mergeInto}`
        );
        console.info(`[DRY-RUN]: git merge --no-edit ${branchMap.branch}`);
        return;
      }

      await execPromise("git fetch -p");
      await execPromise(
        `git checkout ${branchMap.branch} && git pull origin ${
          branchMap.branch
        }`
      );
      await execPromise(
        `git checkout ${branchMap.mergeInto} && git pull origin ${
          branchMap.mergeInto
        }`
      );

      const { error, stdout } = await execPromise(
        `git merge --no-edit ${branchMap.branch}`
      );
      if (error) {
        console.error(
          `CONFLICT: ${branchMap.branch} -> ${branchMap.mergeInto} : ${error}`
        );
        process.exit(1);
      }

      await pushBranch(branchMap.mergeInto);
    }
    /* eslint-enable no-await-in-loop */
  };

  /**
   * Clones the repo and cd's into the directory
   * @param {String} url
   */
  const cloneRepo = async url => {
    if (!gitUrl) {
      throw new Error("There is no specified git URL");
    }
    if (!push) {
      console.info(`[DRY-RUN]: git clone ${gitUrl}`);
      console.info("[DRY-RUN]: cd *");
    }

    await execPromise(`git clone ${gitUrl}`);
    await execPromise("cd *");
  };

  try {
    await execPromise("git fetch -p");
    await setupMergeStrategy();
    const branchNames = await getBranchNames();
    const mergeMap = await composeP(
      getBranchMergeMap,
      sortByBranchVersion,
      getBranchVersionMap,
      filterBranchNames,
      removeOriginPrefix
    )(branchNames);

    await mergeWorkflow(mergeMap);
    process.exit(0);
  } catch (ex) {
    console.error(ex);
    process.exit(1);
  }
})();
